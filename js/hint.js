/**
 * 遊び方モジュール
 * 小さな盤面とピースのアニメーションで、ルールと操作を説明します
 */

// 説明用の盤面（'R' は赤マス、数字はそのマスを覆うピースに含まれる赤マスの数）
const HINT_CLUES = [
    [1, 'R', 'R'],
    [1, 2, 'R']
];

// 説明用のピース（row, col は盤面上の左上の位置）
const HINT_PIECES = {
    a: { grid: [[1, 1], [1, 0]], row: 0, col: 0, colorIndex: 0 }, // 赤マス1個・数字1を2つ覆う（置ける）
    b: { grid: [[0, 1], [1, 1]], row: 0, col: 1, colorIndex: 1 }, // 赤マス2個・数字2を覆う（置ける）
    w: { grid: [[1, 1], [0, 1]], row: 0, col: 0, colorIndex: 3 }  // 赤マス1個なのに数字2も覆う（置けない）
};

// スライドごとの場面：登場するピースと、アニメーションで出す記号
const HINT_SCENES = {
    fill: { pieces: ['a', 'b'], badges: ['ok'] },
    rule: { pieces: ['w', 'a'], badges: ['ng', 'ok'] },
    move: { pieces: ['a'], tray: true, pointer: true, plain: true } // 置き場のピースと同じく、数字や印は出さない
};

// 表示中のスライド番号
let hintSlideIndex = 0;

// 遊び方のボタン・スライドを準備する
function setupHint() {
    document.querySelectorAll('.demo').forEach(demo => {
        buildHintDemo(demo, HINT_SCENES[demo.dataset.scene]);
    });

    // スライド位置を示すドット（押すとそのスライドへ移動）
    getHintSlides().forEach((slide, index) => {
        const dot = document.createElement('button');
        dot.className = 'hint-dot';
        dot.setAttribute('aria-label', `${index + 1}ページ目`);
        dot.addEventListener('click', () => showHintSlide(index));
        elements.hintDots.appendChild(dot);
    });

    elements.hintButton.addEventListener('click', openHint);
    elements.hintClose.addEventListener('click', closeHint);
    elements.hintPrev.addEventListener('click', () => showHintSlide(hintSlideIndex - 1));
    elements.hintNext.addEventListener('click', () => {
        // 最後のスライドでは閉じる
        if (hintSlideIndex === getHintSlides().length - 1) {
            closeHint();
        } else {
            showHintSlide(hintSlideIndex + 1);
        }
    });

    // 背景のクリックや Esc キーでも閉じる
    elements.hintModal.addEventListener('click', (e) => {
        if (e.target === elements.hintModal) closeHint();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.hintModal.classList.contains('active')) closeHint();
    });
}

function getHintSlides() {
    return [...elements.hintModal.querySelectorAll('.hint-slide')];
}

// 遊び方を最初のスライドから開く
function openHint() {
    showHintSlide(0);
    elements.hintModal.classList.add('active');
}

function closeHint() {
    elements.hintModal.classList.remove('active');
}

// 指定したスライドを表示する（表示し直すたびにアニメーションが最初から再生される）
function showHintSlide(index) {
    const slides = getHintSlides();
    hintSlideIndex = Math.max(0, Math.min(index, slides.length - 1));

    slides.forEach((slide, i) => slide.classList.toggle('active', i === hintSlideIndex));
    [...elements.hintDots.children].forEach((dot, i) => dot.classList.toggle('active', i === hintSlideIndex));

    elements.hintPrev.style.visibility = hintSlideIndex === 0 ? 'hidden' : '';
    elements.hintNext.textContent = hintSlideIndex === slides.length - 1 ? 'はじめる' : '次へ';
}

// 説明用の小さな盤面とピースを作る
function buildHintDemo(demo, scene) {
    const board = document.createElement('div');
    board.className = 'demo-board';

    HINT_CLUES.forEach(row => row.forEach(clue => {
        const cell = document.createElement('div');
        cell.className = clue === 'R' ? 'demo-cell mine' : 'demo-cell';
        cell.textContent = clue === 'R' ? '' : clue;
        board.appendChild(cell);
    }));

    scene.pieces.forEach(key => board.appendChild(createHintPiece(key, !scene.plain)));

    (scene.badges || []).forEach(type => {
        const badge = document.createElement('div');
        badge.className = `demo-badge demo-badge-${type}`;
        badge.textContent = type === 'ok' ? '✓' : '✕';
        board.appendChild(badge);
    });

    // 操作の説明では、指の位置を丸で示す
    if (scene.pointer) {
        const pointer = document.createElement('div');
        pointer.className = 'demo-pointer';
        board.appendChild(pointer);
    }

    demo.appendChild(board);

    // ピースの置き場
    if (scene.tray) {
        const tray = document.createElement('div');
        tray.className = 'demo-tray';
        demo.appendChild(tray);
    }
}

// 説明用のピースを作る（showClues なら、覆うマスの数字と赤マスをピースの上に表示し、ルールを見えるようにする）
function createHintPiece(key, showClues) {
    const piece = HINT_PIECES[key];
    const element = document.createElement('div');
    element.className = `demo-piece demo-piece-${key}`;
    element.style.setProperty('--piece-color', PIECE_COLORS[piece.colorIndex]);
    element.style.setProperty('--r', piece.row);
    element.style.setProperty('--col', piece.col);
    element.style.setProperty('--cols', piece.grid[0].length);

    piece.grid.forEach((cells, row) => cells.forEach((filled, col) => {
        const cell = document.createElement('div');
        if (!filled) {
            cell.className = 'demo-piece-cell empty';
        } else {
            const clue = showClues ? HINT_CLUES[piece.row + row][piece.col + col] : '';
            cell.className = clue === 'R' ? 'demo-piece-cell on-mine' : 'demo-piece-cell';
            cell.textContent = clue === 'R' ? '' : clue;
            // 盤面と同じく、同じピースのマス同士の隙間を埋める
            cell.style.boxShadow = getJoinShadow(piece.grid, row, col);
        }
        element.appendChild(cell);
    }));

    return element;
}
