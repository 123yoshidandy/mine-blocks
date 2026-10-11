/**
 * オンライン対戦モジュール
 * 2〜4人で同じ問題を同時に解き、一番早く解いた人がその問題の勝ち。決めた勝ち数に先に届いた人が優勝
 * 問題は、サーバーから届いた問題番号で各端末が作る（generateGame）。サーバーは開始時刻と結果を扱う
 */

const ONLINE_SESSION_KEY = 'mineBlocks.online'; // 再接続に使う部屋番号とトークン
const ONLINE_NAME_KEY = 'mineBlocks.name';      // 次回も同じ名前を使えるように保存する
const ONLINE_RECONNECT_DELAY_MS = 2000;

const onlineState = {
    socket: null,
    session: null,       // { roomCode, token }
    room: null,          // サーバーから届いた部屋の状態（部屋に入っていないときは null）
    seat: null,          // 自分の席番号
    clockOffset: 0,      // サーバーの時計 - 端末の時計（開始時刻を端末の時計に直すため）
    currentRound: null,  // 盤面に出している問題の番号
    countdownTimer: null,
    isLeaving: false
};

// ===== 準備 =====

function setupOnline() {
    onlineState.session = loadOnlineSession();
    elements.onlineName.value = loadOnlineName();

    elements.onlineButton.addEventListener('click', openOnline);
    elements.onlineClose.addEventListener('click', () => elements.onlineModal.classList.remove('active'));
    elements.onlineCreate.addEventListener('click', () => enterRoom({ action: 'create' }));
    elements.onlineJoin.addEventListener('click', () => {
        const roomCode = elements.onlineCode.value.trim();
        if (!/^\d{5}$/.test(roomCode)) {
            showOnlineError('部屋番号（数字5桁）を入れてください');
            return;
        }
        enterRoom({ action: 'join', roomCode });
    });
    elements.onlineInvite.addEventListener('click', shareOnlineInvite);
    elements.onlineWins.addEventListener('change', () => {
        onlineRequest({ action: 'setWinsNeeded', winsNeeded: Number(elements.onlineWins.value) });
    });
    elements.onlineStart.addEventListener('click', () => onlineRequest({ action: 'start' }));
    elements.onlineLeave.addEventListener('click', leaveOnline);
    elements.onlineResultLeave.addEventListener('click', leaveOnline);
    elements.onlineNext.addEventListener('click', () => {
        const room = onlineState.room;
        if (room?.status === 'roundEnd') onlineRequest({ action: 'nextRound', round: room.round.number });
        if (room?.status === 'matchEnd') onlineRequest({ action: 'backToLobby' });
    });

    // 招待URL（?room=部屋番号）で開いたら、前に入った部屋なら同じ席に戻り、初めてなら参加画面を出す
    const roomCode = new URLSearchParams(location.search).get('room');
    if (roomCode) {
        elements.onlineCode.value = roomCode;
        if (onlineState.session?.roomCode === roomCode) {
            enterRoom({ action: 'join', roomCode, token: onlineState.session.token });
        } else {
            openOnline();
        }
    }
}

// 対戦ボタン：部屋に入っていなければ参加画面、ロビーなら部屋の画面を出す。対戦中は退出を確認する
function openOnline() {
    if (isOnlineActive() && onlineState.room.status !== 'lobby') {
        if (window.confirm('対戦から退出しますか？')) leaveOnline();
        return;
    }
    showOnlineError('');
    renderOnlineModal();
    elements.onlineModal.classList.add('active');
}

function isOnlineActive() {
    return onlineState.room !== null;
}

// ===== 接続 =====

function connectOnline() {
    return new Promise((resolve, reject) => {
        const url = getOnlineServerUrl();
        if (!url) {
            reject(new Error('オンライン対戦のサーバーが設定されていません'));
            return;
        }
        const socket = new WebSocket(url);
        onlineState.socket = socket;
        socket.addEventListener('open', () => resolve());
        socket.addEventListener('error', () => reject(new Error('サーバーに接続できませんでした')));
        socket.addEventListener('message', (event) => receiveOnline(JSON.parse(event.data)));
        socket.addEventListener('close', () => {
            if (onlineState.socket !== socket) return;
            // 部屋に入っていれば、少し待ってつなぎ直す（スマホがスリープしたときなど）
            if (!onlineState.isLeaving && onlineState.session && isOnlineActive()) {
                showToast('接続が切れました。再接続しています…');
                setTimeout(reconnectOnline, ONLINE_RECONNECT_DELAY_MS);
            }
        });
    });
}

async function reconnectOnline() {
    if (onlineState.isLeaving || !onlineState.session || isOnlineOpen()) return;
    try {
        await connectOnline();
        onlineRequest({ action: 'join', roomCode: onlineState.session.roomCode, token: onlineState.session.token });
    } catch {
        setTimeout(reconnectOnline, ONLINE_RECONNECT_DELAY_MS);
    }
}

function isOnlineOpen() {
    return onlineState.socket?.readyState === WebSocket.OPEN;
}

function onlineRequest(message) {
    if (!isOnlineOpen()) {
        showToast('接続が切れています。再接続しています…');
        reconnectOnline();
        return false;
    }
    onlineState.socket.send(JSON.stringify(message));
    return true;
}

// 部屋を作る・部屋に入る（名前を保存し、未接続ならつないでから送る）
async function enterRoom(message) {
    const name = elements.onlineName.value.trim();
    saveOnlineName(name);
    showOnlineError('');
    onlineState.isLeaving = false;
    try {
        if (!isOnlineOpen()) await connectOnline();
    } catch (error) {
        showOnlineError(error.message);
        elements.onlineModal.classList.add('active');
        return;
    }
    onlineRequest({ name, ...message });
}

// 部屋を出る（サーバーから「退出した」が届いたら片付ける。つながっていなければすぐ片付ける）
function leaveOnline() {
    if (!onlineRequest({ action: 'leave' })) {
        cleanupOnline();
    }
}

// ===== サーバーからのメッセージ =====

function receiveOnline(message) {
    switch (message.type) {
        case 'joined':
            onlineState.session = { roomCode: message.roomCode, token: message.token };
            saveOnlineSession(onlineState.session);
            setRoomUrl(message.roomCode);
            break;
        case 'room':
            onlineState.room = message.room;
            onlineState.seat = message.seat;
            onlineState.clockOffset = message.serverNow - Date.now();
            handleRoomUpdate();
            break;
        case 'left':
            cleanupOnline();
            break;
        case 'error':
            // 再接続しようとした部屋がなくなっていたら、保存した参加情報を消す
            if (!isOnlineActive()) {
                saveOnlineSession(null);
                onlineState.session = null;
            }
            showOnlineError(message.message);
            if (!elements.onlineModal.classList.contains('active')) showToast(message.message);
            break;
    }
}

// 部屋の状態に合わせて画面を切り替える
function handleRoomUpdate() {
    const room = onlineState.room;
    const round = room.round;

    // チャレンジ中に部屋に入った場合は、チャレンジを止める
    if (challengeState.active) stopChallenge();
    updateOnlineButtons();
    renderOnlineBar();

    if (room.status === 'lobby') {
        stopCountdown();
        onlineState.currentRound = null;
        elements.onlineResultModal.classList.remove('active');
        renderOnlineModal();
        elements.onlineModal.classList.add('active');
        return;
    }

    closeGameModals();
    elements.onlineModal.classList.remove('active');

    if (room.status === 'playing') {
        if (onlineState.currentRound !== round.number) {
            startRoundCountdown(round);
        } else if (round.results[onlineState.seat]) {
            // 降参して、ほかの人を待っている
            renderOnlineResult();
        }
        return;
    }

    // 問題・試合が終わった：盤面がこの問題でなければ作り直してから、結果と想定解を出す
    stopCountdown();
    if (onlineState.currentRound !== round.number || gameState.seed !== round.seed) {
        generateGame(round.seed);
        onlineState.currentRound = round.number;
    }
    stopTimer();
    renderOnlineResult();
}

// 開始時刻までカウントダウンし、0になったら問題を出す（開始前に問題が見えないよう、盤面はそのとき作る）
function startRoundCountdown(round) {
    stopCountdown();
    elements.onlineResultModal.classList.remove('active');
    const startAt = round.startAt - onlineState.clockOffset;

    const tick = () => {
        const remaining = Math.ceil((startAt - Date.now()) / 1000);
        if (remaining <= 0) {
            stopCountdown();
            onlineState.currentRound = round.number;
            generateGame(round.seed);
            return;
        }
        elements.onlineCountdownNumber.textContent = remaining;
        elements.onlineCountdownRound.textContent = `第${round.number}問`;
        elements.onlineCountdown.hidden = false;
    };
    tick();
    if (onlineState.currentRound !== round.number) {
        onlineState.countdownTimer = setInterval(tick, 100);
    }
}

function stopCountdown() {
    clearInterval(onlineState.countdownTimer);
    onlineState.countdownTimer = null;
    elements.onlineCountdown.hidden = true;
}

// ===== 盤面からの通知 =====

// 盤面がすべて埋まった：サーバーに知らせる（勝敗はサーバーに届いた順で決まる）
function onOnlinePuzzleSolved() {
    stopTimer();
    onlineRequest({ action: 'solved', round: onlineState.currentRound });
}

// 降参：この問題ではもう勝てない。ほかの人が解き終わるのを、想定解を見ながら待つ
function onlineSurrender() {
    if (onlineState.room?.status !== 'playing' || onlineState.currentRound === null) return;
    stopTimer();
    selectBlock(-1);
    clearHoverPreview();
    onlineRequest({ action: 'surrender', round: onlineState.currentRound });
}

// ===== 描画 =====

// 参加画面（部屋に入る前）と部屋の画面（ロビー）
function renderOnlineModal() {
    const room = onlineState.room;
    const inLobby = room?.status === 'lobby';
    elements.onlineEntry.hidden = inLobby;
    elements.onlineLobby.hidden = !inLobby;
    if (!inLobby) return;

    const isHost = onlineState.seat === 0;
    elements.onlineRoomCode.textContent = room.code;
    renderPlayerList(elements.onlinePlayers, { showHost: true });
    elements.onlineWins.value = String(room.winsNeeded);
    elements.onlineWins.disabled = !isHost;
    elements.onlineStart.hidden = !isHost;
    elements.onlineStart.disabled = room.players.length < 2;
    elements.onlineWaiting.textContent = isHost
        ? (room.players.length < 2 ? '2人以上で始められます。招待URLを送ってください' : '')
        : '部屋を作った人が開始するのを待っています';
}

// 参加者の一覧（名前・勝ち数・状態）
function renderPlayerList(list, { showHost = false } = {}) {
    const room = onlineState.room;
    list.innerHTML = '';
    room.players.forEach(player => {
        const item = document.createElement('li');
        item.className = 'online-player';
        item.classList.toggle('is-me', player.seat === onlineState.seat);
        item.classList.toggle('is-winner', room.round?.winner === player.seat && room.status !== 'playing');

        const name = document.createElement('span');
        name.className = 'online-player-name';
        name.textContent = player.name + (player.seat === onlineState.seat ? '（あなた）' : '');
        item.appendChild(name);

        const note = document.createElement('span');
        note.className = 'online-player-note';
        note.textContent = getPlayerNote(player, { showHost });
        item.appendChild(note);

        if (room.status !== 'lobby') {
            const wins = document.createElement('span');
            wins.className = 'online-player-wins';
            wins.textContent = `${player.wins} / ${room.winsNeeded}勝`;
            item.appendChild(wins);
        }
        list.appendChild(item);
    });
}

function getPlayerNote(player, { showHost }) {
    const result = onlineState.room.round?.results?.[player.seat];
    if (player.left) return '退出';
    if (!player.connected) return '切断中';
    if (result?.result === 'surrendered') return '降参';
    if (showHost && player.seat === 0) return '部屋を作った人';
    return '';
}

// 盤面の上に、全員の名前と勝ち数を出す
function renderOnlineBar() {
    const room = onlineState.room;
    const show = room && room.status !== 'lobby';
    elements.onlineBar.hidden = !show;
    if (!show) return;

    elements.onlineBar.innerHTML = '';
    const round = document.createElement('span');
    round.className = 'online-bar-round';
    round.textContent = `第${room.round.number}問・${room.winsNeeded}勝先取`;
    elements.onlineBar.appendChild(round);

    room.players.forEach(player => {
        const chip = document.createElement('span');
        chip.className = 'online-chip';
        chip.classList.toggle('is-me', player.seat === onlineState.seat);
        chip.classList.toggle('is-out', player.left || !player.connected || Boolean(room.round.results[player.seat]));
        chip.textContent = `${player.name} ${player.wins}`;
        elements.onlineBar.appendChild(chip);
    });
}

// 結果画面：問題の勝者と全員の勝ち数、想定解を出す（降参して待っているときも同じ画面）
function renderOnlineResult() {
    const room = onlineState.room;
    const round = room.round;
    const winner = round.winner !== null ? room.players[round.winner] : null;

    let title;
    let detail = '';
    if (room.status === 'playing') {
        title = '降参しました';
        detail = 'ほかの人が解き終わるのを待っています';
    } else if (room.status === 'matchEnd') {
        title = `${winner.name}さんの優勝！`;
        detail = `第${round.number}問を ${formatOnlineTime(round.winnerTime)} で解きました`;
    } else if (winner) {
        title = round.winner === onlineState.seat ? 'あなたの勝ち！' : `${winner.name}さんの勝ち`;
        detail = `${formatOnlineTime(round.winnerTime)} で解きました`;
    } else {
        title = '勝者なし';
        detail = '全員が降参しました';
    }

    elements.onlineResultTitle.textContent = title;
    elements.onlineResultDetail.textContent = detail;
    renderPlayerList(elements.onlineStandings);
    renderSolutionBoard(elements.onlineSolutionBoard);

    elements.onlineNext.hidden = room.status === 'playing';
    elements.onlineNext.textContent = room.status === 'matchEnd' ? '部屋に戻る' : '次の問題へ';
    elements.onlineResultModal.classList.add('active');
}

function formatOnlineTime(ms) {
    return `${(ms / 1000).toFixed(1)}秒`;
}

// 対戦中は、チャレンジボタンを使えなくし、対戦ボタンを強調する
function updateOnlineButtons() {
    const active = isOnlineActive();
    elements.onlineButton.classList.toggle('active', active);
    elements.challengeToggleButton.disabled = active;
}

// ほかのモーダル（クリア・降参・チャレンジ結果）を閉じる
function closeGameModals() {
    elements.clearModal.classList.remove('active');
    elements.surrenderModal.classList.remove('active');
    elements.challengeModal.classList.remove('active');
}

function showOnlineError(message) {
    elements.onlineError.textContent = message;
}

// 画面下に短いお知らせを出す
function showToast(message) {
    const toast = elements.toast;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 3000);
}

// ===== 招待 =====

function getOnlineInviteUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', onlineState.room.code);
    return url.toString();
}

// 招待URLを共有する（スマホでは共有シート、パソコンではクリップボードへのコピー）
async function shareOnlineInvite() {
    const url = getOnlineInviteUrl();
    if (window.matchMedia('(pointer: coarse)').matches && navigator.share) {
        try {
            await navigator.share({ title: 'MINE BLOCKS', text: `MINE BLOCKS で対戦しよう！ 部屋番号 ${onlineState.room.code}`, url });
        } catch {
            // 共有シートをキャンセルした場合などは何もしない
        }
        return;
    }
    try {
        await navigator.clipboard.writeText(url);
        showToast('招待URLをコピーしました');
    } catch {
        window.prompt('このURLを送ってください', url);
    }
}

// ===== 片付けと保存 =====

// 部屋を出たら、接続を閉じてエンドレスに戻る
function cleanupOnline() {
    onlineState.isLeaving = true;
    stopCountdown();
    onlineState.room = null;
    onlineState.seat = null;
    onlineState.currentRound = null;
    onlineState.session = null;
    saveOnlineSession(null);
    onlineState.socket?.close();
    onlineState.socket = null;

    elements.onlineModal.classList.remove('active');
    elements.onlineResultModal.classList.remove('active');
    updateOnlineButtons();
    renderOnlineBar();
    setRoomUrl(null);
    generateGame(gameState.endlessSeed ?? gameState.initialSeed);
}

// URLに部屋番号を入れる（再読み込みしても部屋に戻れる）。部屋を出たら外す
function setRoomUrl(roomCode) {
    const url = new URL(location.href);
    if (roomCode) {
        url.searchParams.set('room', roomCode);
        url.searchParams.delete('seed');
    } else {
        url.searchParams.delete('room');
    }
    history.replaceState(null, '', url);
}

function loadOnlineSession() {
    try {
        return JSON.parse(localStorage.getItem(ONLINE_SESSION_KEY) || 'null');
    } catch {
        return null;
    }
}

function saveOnlineSession(session) {
    try {
        if (session) {
            localStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify(session));
        } else {
            localStorage.removeItem(ONLINE_SESSION_KEY);
        }
    } catch {
        // 保存できなくても、このページを開いている間は遊べる
    }
}

function loadOnlineName() {
    try {
        return localStorage.getItem(ONLINE_NAME_KEY) || '';
    } catch {
        return '';
    }
}

function saveOnlineName(name) {
    try {
        localStorage.setItem(ONLINE_NAME_KEY, name);
    } catch {
        // 保存できなくても遊べる
    }
}
