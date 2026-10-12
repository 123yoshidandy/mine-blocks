/**
 * トップ画面モジュール
 * 開いたときに出る画面で、遊び方（エンドレス・チャレンジ・オンライン対戦）を選ぶ
 * ヘッダーのロゴを押すと、トップ画面に戻る
 */

// トップ画面の絵（盤面を模したもの）。英字は同じピースのマス、数字は数字のマス、m は地雷のマス
const TOP_HERO_LAYOUT = [
    ['a', 'a', '2', 'm'],
    ['a', '1', 'm', 'b'],
    ['3', 'c', 'c', 'b']
];
const TOP_HERO_COLORS = { a: 0, b: 3, c: 1 }; // PIECE_COLORS の番号

function setupTop() {
    renderTopHero();

    elements.topEndless.addEventListener('click', () => {
        hideTop();
        startTimer(); // トップ画面を見ていた時間は数えない
    });
    elements.topChallenge.addEventListener('click', () => {
        hideTop();
        startChallenge();
    });
    elements.topOnline.addEventListener('click', () => {
        hideTop();
        openOnline();
    });
    elements.topHint.addEventListener('click', openHint);
    elements.logoButton.addEventListener('click', goToTop);
    elements.homeButton.addEventListener('click', goToTop);

    // 招待URL（?room=）で開いたときは、トップ画面を出さずに部屋の画面に進む
    if (!NetplayClient.roomCodeFromUrl()) {
        showTop();
    }
}

function showTop() {
    stopTimer();
    elements.topScreen.hidden = false;
    document.body.classList.add('is-top');
}

function hideTop() {
    elements.topScreen.hidden = true;
    document.body.classList.remove('is-top');
}

// ロゴかホームのボタンからトップ画面に戻る。チャレンジ中ならそのまま終え、対戦中は確認してから退出する
function goToTop() {
    if (isOnlineActive()) {
        if (!window.confirm('対戦から退出してトップに戻りますか？')) return;
        leaveOnline();
    } else if (challengeState.active) {
        exitChallenge();
    }
    elements.clearModal.classList.remove('active');
    elements.surrenderModal.classList.remove('active');
    showTop();
}

// トップ画面の絵を作る（ピースは盤面と同じく、マス同士の隙間を埋めて1つにつなげる）
function renderTopHero() {
    const hero = elements.topHero;
    hero.innerHTML = '';
    hero.style.gridTemplateColumns = `repeat(${TOP_HERO_LAYOUT[0].length}, var(--hero-cell))`;

    TOP_HERO_LAYOUT.forEach((row, r) => row.forEach((token, c) => {
        const cell = document.createElement('div');
        cell.style.setProperty('--i', r * row.length + c); // 出てくる順番
        if (token === 'm') {
            cell.className = 'hero-cell hero-mine';
        } else if (/^\d$/.test(token)) {
            cell.className = 'hero-cell hero-number';
            cell.textContent = token;
            cell.dataset.n = token;
        } else {
            const grid = TOP_HERO_LAYOUT.map(cells => cells.map(t => (t === token ? 1 : 0)));
            cell.className = 'hero-cell hero-piece';
            cell.style.setProperty('--piece-color', PIECE_COLORS[TOP_HERO_COLORS[token]]);
            cell.style.setProperty('--join-shadow', getJoinShadow(grid, r, c));
        }
        hero.appendChild(cell);
    }));
}
