/**
 * オンライン対戦モジュール
 * 2〜4人で同じ問題を同時に解き、一番早く解いた人がその問題の勝ち。決めた勝ち数に先に届いた人が優勝
 * 問題は、サーバーから届いた問題番号で各端末が作る（generateGame）。サーバーは開始時刻と結果を扱う
 * 問題が終わると、サーバーは次の問題（next）をすぐに決めて配る。結果画面で想定解を見せながら開始時刻までカウントダウンし、
 * 0になったら全員が同時に次の問題を始める（サーバーからの知らせは待たない）
 *
 * 接続・再接続・参加情報の保存・ping・時計のずれの補正・招待URLは netplay-kit の NetplayClient（js/netplay/）が行い、
 * ここでは画面（参加画面・ロビー・カウントダウン・対戦中のバー・結果画面）を受け持つ
 */

const ONLINE_NAME_KEY = 'mineBlocks.name'; // 次回も同じ名前を使えるように保存する

const net = new NetplayClient({
    serverUrl: NetplayClient.resolveServerUrl({ deployed: ONLINE_DEPLOYED_SERVER_URL }),
    storageKey: 'mineBlocks.online'
});

const onlineState = {
    lobby: null,         // 部屋の状態（参加者・ホスト・設定。部屋に入っていないときは null）
    game: null,          // 対戦の中身（問題・勝ち数・段階。今の試合のものだけ）
    gameMatchId: null,   // game がどの試合のものか
    currentRound: null,  // 盤面に出している問題の番号
    countdownTimer: null
};

// ===== 準備 =====

function setupOnline() {
    elements.onlineName.value = loadOnlineName();
    // 部屋番号の桁数は netplay-kit に合わせる
    elements.onlineCode.maxLength = NetplayClient.ROOM_CODE_LENGTH;
    elements.onlineCode.placeholder = `数字${NetplayClient.ROOM_CODE_LENGTH}桁`;

    net.on('joined', (message) => setOnlineRoomUrl(message.roomCode));
    net.on('lobby', (lobby) => {
        onlineState.lobby = lobby;
        // ロビーに戻ったら、前の試合の中身は使わない
        if (lobby.status === 'lobby') onlineState.game = null;
        handleRoomUpdate();
    });
    net.on('state', (state) => {
        // 再戦で新しい試合になったら、盤面の問題の番号を忘れる（前の試合と同じ第1問でも、カウントダウンから始める）
        if (state.matchId !== onlineState.gameMatchId) onlineState.currentRound = null;
        onlineState.game = state.view;
        onlineState.gameMatchId = state.matchId;
        handleRoomUpdate();
    });
    net.on('left', cleanupOnline);
    net.on('error', ({ message }) => {
        showOnlineError(message);
        if (!elements.onlineModal.classList.contains('active')) showToast(message);
    });
    net.on('connection', (connected) => {
        if (!connected && isOnlineActive()) showToast('接続が切れました。再接続しています…');
    });

    // 参加画面を × で閉じたら、ホーム（トップ画面）に戻る（招待URLで開いたときも同じ）
    elements.onlineClose.addEventListener('click', () => {
        elements.onlineModal.classList.remove('active');
        if (!isOnlineActive()) showTop();
    });
    elements.onlineCreate.addEventListener('click', () => enterRoom(name => net.createRoom(name)));
    elements.onlineJoin.addEventListener('click', () => {
        const roomCode = elements.onlineCode.value.trim();
        if (!NetplayClient.isRoomCode(roomCode)) {
            showOnlineError(`部屋番号（数字${NetplayClient.ROOM_CODE_LENGTH}桁）を入れてください`);
            return;
        }
        enterRoom(name => net.joinRoom(roomCode, name));
    });
    elements.onlineInvite.addEventListener('click', shareOnlineInvite);
    elements.onlineWins.addEventListener('change', () => {
        net.setSettings({ winsNeeded: Number(elements.onlineWins.value) });
    });
    elements.onlineStart.addEventListener('click', () => net.start());
    elements.onlineLeave.addEventListener('click', leaveOnline);
    elements.onlineResultLeave.addEventListener('click', leaveOnline);
    // 再戦する：全員が押したら、同じ顔ぶれ・同じ勝ち数で次の試合が始まる
    elements.onlineNext.addEventListener('click', () => {
        if (getOnlineStage() !== 'matchEnd') return;
        net.ready(true).catch(error => showToast(error.message));
    });

    // 招待URL（?room=部屋番号）で開いたら、前に入った部屋なら同じ席に戻り、初めてなら参加画面を出す
    const roomCode = NetplayClient.roomCodeFromUrl();
    if (roomCode) {
        elements.onlineCode.value = roomCode;
        if (net.session?.roomCode === roomCode) {
            net.resume().catch(error => showToast(error.message));
        } else {
            openOnline();
        }
    }
}

// オンライン対戦の参加画面を出す（トップ画面の「オンライン対戦」から）
function openOnline() {
    showOnlineError('');
    renderOnlineModal();
    elements.onlineModal.classList.add('active');
}

function isOnlineActive() {
    return onlineState.lobby !== null;
}

// 部屋を作る・部屋に入る（名前を保存してから送る）
async function enterRoom(request) {
    const name = elements.onlineName.value.trim();
    saveOnlineName(name);
    showOnlineError('');
    try {
        await request(name);
    } catch (error) {
        showOnlineError(error.message);
        elements.onlineModal.classList.add('active');
    }
}

// 部屋を出る（返事を待たずに画面を片付ける。参加情報は NetplayClient が消す）
function leaveOnline() {
    net.leave();
    cleanupOnline();
}

// ===== 画面の切り替え =====

// 今の試合の中身（前の試合のものが残っていれば null）
function getOnlineGame() {
    const lobby = onlineState.lobby;
    if (!lobby || lobby.status === 'lobby' || onlineState.gameMatchId !== lobby.matchId) return null;
    return onlineState.game;
}

// 画面の段階：'lobby' / 'waiting'（試合の中身を待っている）/ 'playing' / 'roundEnd' / 'matchEnd'
function getOnlineStage() {
    const lobby = onlineState.lobby;
    if (!lobby) return null;
    if (lobby.status === 'lobby') return 'lobby';
    const game = getOnlineGame();
    if (!game) return 'waiting';
    // 試合終了は、部屋の状態（lobby）が先に届き、最後の問題の結果（state）があとから届く。結果が届くまでは待つ
    if (lobby.status === 'ended') return game.phase === 'roundEnd' ? 'matchEnd' : 'waiting';
    if (game.phase === 'roundEnd' && !isNextRoundDue(game)) return 'roundEnd';
    return 'playing';
}

// 次の問題の開始時刻を過ぎたか（サーバーは、開始時刻のあとに最初のメッセージが届くまで、前の問題の結果のまま）
function isNextRoundDue(game) {
    return Boolean(game.next) && net.serverNow() >= game.next.startAt;
}

// 今の問題（次の問題の開始時刻を過ぎていれば、まだ誰も解いていない次の問題）
function getOnlineRound() {
    const game = getOnlineGame();
    if (!game) return null;
    if (game.phase !== 'roundEnd' || !isNextRoundDue(game)) return game.round;
    return { ...game.next, results: game.round.results.map(() => null), winner: null, winnerTime: null };
}

// 部屋の状態に合わせて画面を切り替える
function handleRoomUpdate() {
    const stage = getOnlineStage();

    // 部屋に入ったら、トップ画面やチャレンジは閉じる
    hideTop();
    if (challengeState.active) stopChallenge();
    renderOnlineBar();

    if (stage === 'lobby') {
        stopCountdown();
        onlineState.currentRound = null;
        elements.onlineResultModal.classList.remove('active');
        renderOnlineModal();
        elements.onlineModal.classList.add('active');
        return;
    }
    if (stage === 'waiting') return;

    const round = getOnlineRound();
    closeGameModals();
    elements.onlineModal.classList.remove('active');

    if (stage === 'playing') {
        if (onlineState.currentRound !== round.number) {
            startRoundCountdown(round);
        } else if (round.results[net.seat]) {
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
    renderOnlineResult();
    if (stage === 'roundEnd') startNextRoundCountdown(getOnlineGame().next);
}

// 結果画面で、想定解を見せたまま次の問題の開始時刻までカウントダウンする。0になったら次の問題を始める
function startNextRoundCountdown(next) {
    const startAt = net.toLocalTime(next.startAt);
    elements.onlineNextRound.textContent = `第${next.number}問`;
    elements.onlineNextNumber.textContent = '';
    const tick = () => {
        const remaining = Math.ceil((startAt - Date.now()) / 1000);
        if (remaining <= 0) {
            stopCountdown();
            playCountdownSound(next.number, 'go');
            handleRoomUpdate();
            return;
        }
        // 数字が変わったときだけ書き換え、弾む動きを最初から出し直す（最後の3秒は音でも知らせる）
        const number = elements.onlineNextNumber;
        if (number.textContent !== String(remaining)) {
            number.textContent = remaining;
            number.classList.remove('tick');
            void number.offsetWidth;
            number.classList.add('tick');
            if (remaining <= 3) playCountdownSound(next.number, remaining);
        }
    };
    tick();
    onlineState.countdownTimer = setInterval(tick, 100);
}

// 開始時刻までカウントダウンし、0になったら問題を出す（開始前に問題が見えないよう、盤面はそのとき作る）
function startRoundCountdown(round) {
    stopCountdown();
    elements.onlineResultModal.classList.remove('active');
    const startAt = net.toLocalTime(round.startAt);

    const tick = () => {
        const remaining = Math.ceil((startAt - Date.now()) / 1000);
        if (remaining <= 0) {
            // カウントダウンを見せていたときだけ、開始の音を鳴らす（再接続などで、すでに始まっていた問題では鳴らさない）
            const wasCounting = onlineState.countdownTimer !== null;
            stopCountdown();
            if (wasCounting) playCountdownSound(round.number, 'go');
            onlineState.currentRound = round.number;
            generateGame(round.seed);
            return;
        }
        playCountdownSound(round.number, remaining);
        elements.onlineCountdownNumber.textContent = remaining;
        elements.onlineCountdownRound.textContent = `第${round.number}問`;
        elements.onlineCountdown.hidden = false;
    };
    tick();
    if (onlineState.currentRound !== round.number) {
        onlineState.countdownTimer = setInterval(tick, 100);
    }
}

// カウントダウンの音（数字は 'count'、開始は 'go'）。表示の出し直しで同じ数字を2回鳴らさないよう、鳴らした数字を覚えておく
function playCountdownSound(roundNumber, remaining) {
    const key = `${onlineState.gameMatchId}-${roundNumber}-${remaining}`;
    if (onlineState.lastCountdownSound === key) return;
    onlineState.lastCountdownSound = key;
    playSound(remaining === 'go' ? 'go' : 'count');
}

function stopCountdown() {
    clearInterval(onlineState.countdownTimer);
    onlineState.countdownTimer = null;
    elements.onlineCountdown.hidden = true;
}

// ===== 盤面からの通知 =====

// 盤面がすべて埋まった：サーバーに知らせる（勝敗はサーバーに届いた順で決まる）
function onOnlinePuzzleSolved() {
    net.send('solved', { round: onlineState.currentRound });
}

// 降参：この問題ではもう勝てない。ほかの人が解き終わるのを、想定解を見ながら待つ
function onlineSurrender() {
    if (getOnlineStage() !== 'playing' || onlineState.currentRound === null) return;
    selectBlock(-1);
    clearHoverPreview();
    playSound('surrender');
    net.send('surrender', { round: onlineState.currentRound });
}

// ===== 描画 =====

// 参加画面（部屋に入る前）と部屋の画面（ロビー）
function renderOnlineModal() {
    const lobby = onlineState.lobby;
    const inLobby = lobby?.status === 'lobby';
    elements.onlineEntry.hidden = inLobby;
    elements.onlineLobby.hidden = !inLobby;
    // 部屋に入っている間は閉じられない（開き直す入口がないため。出るときは「部屋を出る」）
    elements.onlineClose.hidden = inLobby;
    if (!inLobby) return;

    const isHost = net.isHost();
    const enough = lobby.players.filter(player => !player.left).length >= 2;
    elements.onlineRoomCode.textContent = lobby.roomCode;
    renderPlayerList(elements.onlinePlayers, { showHost: true });
    elements.onlineWins.value = String(lobby.settings.winsNeeded);
    elements.onlineWins.disabled = !isHost;
    elements.onlineStart.hidden = !isHost;
    elements.onlineStart.disabled = !enough;
    elements.onlineWaiting.textContent = isHost
        ? (enough ? '' : '2人以上で始められます。招待URLを送ってください')
        : '部屋を作った人が開始するのを待っています';
}

// 参加者の一覧（名前・勝ち数・状態）
function renderPlayerList(list, { showHost = false } = {}) {
    const lobby = onlineState.lobby;
    const game = getOnlineGame();
    const round = getOnlineRound();
    list.innerHTML = '';
    lobby.players.forEach((player, seat) => {
        const item = document.createElement('li');
        item.className = 'online-player';
        item.classList.toggle('is-me', seat === net.seat);
        item.classList.toggle('is-winner', round?.winner === seat && getOnlineStage() !== 'playing');

        const name = document.createElement('span');
        name.className = 'online-player-name';
        name.textContent = player.name + (seat === net.seat ? '（あなた）' : '');
        item.appendChild(name);

        const note = document.createElement('span');
        note.className = 'online-player-note';
        note.textContent = getPlayerNote(player, seat, { showHost });
        item.appendChild(note);

        if (game) {
            const wins = document.createElement('span');
            wins.className = 'online-player-wins';
            wins.textContent = `${game.wins[seat]} / ${game.winsNeeded}勝`;
            item.appendChild(wins);
        }
        list.appendChild(item);
    });
}

function getPlayerNote(player, seat, { showHost }) {
    const result = getOnlineRound()?.results[seat];
    if (player.left) return '退出';
    if (!player.connected) return '切断中';
    if (onlineState.lobby.status === 'ended' && player.ready) return '再戦OK';
    if (result?.result === 'surrendered') return '降参';
    if (showHost && seat === onlineState.lobby.hostSeat) return '部屋を作った人';
    return '';
}

// 盤面の上に、全員の名前と勝ち数を出す
function renderOnlineBar() {
    const lobby = onlineState.lobby;
    const game = getOnlineGame();
    const show = Boolean(game);
    elements.onlineBar.hidden = !show;
    if (!show) return;

    const currentRound = getOnlineRound();
    elements.onlineBar.innerHTML = '';
    const round = document.createElement('span');
    round.className = 'online-bar-round';
    round.textContent = `第${currentRound.number}問・${game.winsNeeded}勝先取`;
    elements.onlineBar.appendChild(round);

    lobby.players.forEach((player, seat) => {
        const chip = document.createElement('span');
        chip.className = 'online-chip';
        chip.classList.toggle('is-me', seat === net.seat);
        chip.classList.toggle('is-out', player.left || !player.connected || Boolean(currentRound.results[seat]));
        chip.textContent = `${player.name} ${game.wins[seat]}`;
        elements.onlineBar.appendChild(chip);
    });
}

// 結果画面：問題の勝者と全員の勝ち数、想定解を出す（降参して待っているときも同じ画面）
function renderOnlineResult() {
    const stage = getOnlineStage();
    const round = getOnlineRound();
    const winner = round.winner !== null ? onlineState.lobby.players[round.winner] : null;

    let title;
    let detail = '';
    if (stage === 'playing') {
        title = '降参しました';
        detail = 'ほかの人が解き終わるのを待っています';
    } else if (stage === 'matchEnd') {
        title = `${winner.name}さんの優勝！`;
        detail = `第${round.number}問を ${formatOnlineTime(round.winnerTime)} で解きました`;
    } else if (winner) {
        title = round.winner === net.seat ? 'あなたの勝ち！' : `${winner.name}さんの勝ち`;
        detail = `${formatOnlineTime(round.winnerTime)} で解きました`;
    } else {
        title = '勝者なし';
        detail = '全員が降参しました';
    }

    elements.onlineResultTitle.textContent = title;
    elements.onlineResultDetail.textContent = detail;
    renderPlayerList(elements.onlineStandings);
    renderSolutionBoard(elements.onlineSolutionBoard);

    // 試合の途中は押さなくても次の問題に進むので、ボタンは出さずにカウントダウンを出す。試合が終わったら再戦するボタンを出す
    elements.onlineNext.hidden = stage !== 'matchEnd';
    if (stage === 'matchEnd') renderRematchButton();
    elements.onlineResultLeave.hidden = stage === 'roundEnd';
    elements.onlineNextCountdown.hidden = stage !== 'roundEnd';
    elements.onlineResultModal.classList.add('active');
    playOnlineResultSound(stage, round);
}

// 結果の音：自分が勝てばファンファーレ（優勝なら長いもの）、ほかの人が勝てば下がる音
// 勝者なし（全員が降参）のときは、降参を押したときに鳴らしたので鳴らさない
// 結果画面は部屋の状態が変わるたびに描き直すので、同じ結果では1回だけ鳴らす
function playOnlineResultSound(stage, round) {
    if (stage === 'playing') return; // 降参して待っているとき（降参の音は押したときに鳴らした）
    const key = `${onlineState.gameMatchId}-${round.number}-${stage}`;
    if (onlineState.lastResultSound === key) return;
    onlineState.lastResultSound = key;

    const won = round.winner === net.seat;
    if (stage === 'matchEnd') playSound(won ? 'victory' : 'lose');
    else if (round.winner !== null) playSound(won ? 'clear' : 'lose');
}

// 再戦するボタン：押したら、ほかの人を待つ表示にする。退出して1人になったら押せない
function renderRematchButton() {
    const players = onlineState.lobby.players.filter(player => !player.left);
    const me = onlineState.lobby.players[net.seat];
    const button = elements.onlineNext;
    if (players.length < 2) {
        button.textContent = '再戦できる相手がいません';
        button.disabled = true;
    } else if (me?.ready) {
        const readyCount = players.filter(player => player.ready).length;
        button.textContent = `ほかの人を待っています（${readyCount}/${players.length}人）`;
        button.disabled = true;
    } else {
        button.textContent = '再戦する';
        button.disabled = false;
    }
}

function formatOnlineTime(ms) {
    return `${(ms / 1000).toFixed(1)}秒`;
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

// 招待URLを共有する（スマホでは共有シート、パソコンではクリップボードへのコピー）
async function shareOnlineInvite() {
    const url = net.inviteUrl();
    const roomCode = onlineState.lobby.roomCode;
    if (window.matchMedia('(pointer: coarse)').matches && navigator.share) {
        try {
            await navigator.share({ title: 'MINE BLOCKS', text: `MINE BLOCKS で対戦しよう！ 部屋番号 ${roomCode}`, url });
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

// URLに部屋番号を入れる（再読み込みしても部屋に戻れる）
function setOnlineRoomUrl(roomCode) {
    net.setRoomUrl(roomCode);
}

// ===== 片付けと保存 =====

// 部屋を出たら、画面を片付けてホーム（トップ画面）に戻る（2回呼ばれても同じ結果になる）
// 「部屋を出る」ボタン・ヘッダーのホーム・サーバーからの退出の知らせの、どれで出ても同じ
function cleanupOnline() {
    if (!isOnlineActive() && onlineState.currentRound === null && elements.onlineBar.hidden) return;
    stopCountdown();
    onlineState.lobby = null;
    onlineState.game = null;
    onlineState.gameMatchId = null;
    onlineState.currentRound = null;

    elements.onlineModal.classList.remove('active');
    elements.onlineResultModal.classList.remove('active');
    renderOnlineBar();
    net.setRoomUrl(null);
    generateGame(createRandomSeed()); // 対戦の盤面を片付ける（エンドレスはトップ画面から選んだときに新しい問題を出す）
    showTop();
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
