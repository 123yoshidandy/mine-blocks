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
    layoutTopHero();
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

    // 出てくる順番：数字と地雷は1マスずつ、ピースは最初のマスの順番で1つの絵ごと
    const flat = TOP_HERO_LAYOUT.flat();

    TOP_HERO_LAYOUT.forEach((row, r) => row.forEach((token, c) => {
        const cell = document.createElement('div');
        cell.style.setProperty('--i', r * row.length + c);
        if (token === 'm') {
            cell.className = 'hero-cell hero-mine';
        } else if (/^\d$/.test(token)) {
            cell.className = 'hero-cell hero-number';
            cell.textContent = token;
            cell.dataset.n = token;
        } else {
            // ピースのマスは場所だけ取っておき、見た目は上に重ねる絵（layoutTopHero）が受け持つ
            cell.className = 'hero-cell hero-slot';
        }
        cell.dataset.row = r;
        cell.dataset.col = c;
        hero.appendChild(cell);
    }));

    // ピースごとの絵（ピース1つを1つの SVG にして、つなぎ目に線が出ないようにする）
    topHeroPieces.length = 0;
    Object.keys(TOP_HERO_COLORS).forEach(token => {
        const cells = [];
        TOP_HERO_LAYOUT.forEach((row, r) => row.forEach((t, c) => { if (t === token) cells.push([r, c]); }));
        const top = Math.min(...cells.map(([r]) => r));
        const left = Math.min(...cells.map(([, c]) => c));
        const bottom = Math.max(...cells.map(([r]) => r));
        const right = Math.max(...cells.map(([, c]) => c));
        const grid = Array.from({ length: bottom - top + 1 }, (_, r) =>
            Array.from({ length: right - left + 1 }, (_, c) => (TOP_HERO_LAYOUT[top + r][left + c] === token ? 1 : 0)));

        const element = document.createElement('div');
        element.className = 'hero-piece';
        element.style.setProperty('--piece-color', PIECE_COLORS[TOP_HERO_COLORS[token]]);
        element.style.setProperty('--i', flat.indexOf(token));
        hero.appendChild(element);
        topHeroPieces.push({ element, top, left, grid, color: PIECE_COLORS[TOP_HERO_COLORS[token]] });
    });
}

// トップの絵のピースの位置と大きさを、実際のマスから測って決める（画面を出したとき・大きさが変わったとき）
const topHeroPieces = [];

function layoutTopHero() {
    if (elements.topScreen.hidden) return;
    const gap = parseFloat(getComputedStyle(elements.topHero).columnGap) || 0;
    topHeroPieces.forEach(({ element, top, left, grid, color }) => {
        const origin = elements.topHero.querySelector(`.hero-cell[data-row="${top}"][data-col="${left}"]`);
        element.style.left = `${origin.offsetLeft}px`;
        element.style.top = `${origin.offsetTop}px`;
        element.replaceChildren(createPieceSvg(grid, origin.offsetWidth, gap, color));
    });
}

window.addEventListener('resize', layoutTopHero);
