/**
 * 降参モジュール
 * 解けなかったときに降参し、結果画面で想定解を表示します
 */

// 降参ボタンと結果画面のボタンを準備する
function setupSurrender() {
    elements.surrenderButton.addEventListener('click', surrender);
    elements.surrenderNextButton.addEventListener('click', () => {
        elements.surrenderModal.classList.remove('active');
        generateGame(createRandomSeed());
    });

    // 降参画面：ホームに戻る
    elements.surrenderHomeButton.addEventListener('click', goToTop);
}

// タイマーを止め、想定解を結果画面に表示する（クリア回数には数えない）
// チャレンジ中の降参はタイムアップと同じく、チャレンジを終えて結果（解いた数と想定解）を表示する
function surrender() {
    // オンライン対戦中は、その問題だけ降参する（ほかの人が解き終わるまで想定解を見ながら待つ）
    if (isOnlineActive()) {
        onlineSurrender();
        return;
    }

    if (challengeState.active) {
        finishChallenge();
        return;
    }

    stopTimer();
    selectBlock(-1);
    clearHoverPreview();

    renderSolutionBoard(elements.solutionBoard);
    elements.surrenderModal.classList.add('active');
    playSound('surrender');
}

// 想定解を指定した要素に小さな盤面として描く
// ピースは盤面に置いたピースと同じ絵（数字は白、地雷は赤い丸の印）で描く（置けないマスは斜線）
function renderSolutionBoard(container) {
    const rows = gameState.boardRows;
    const cols = gameState.boardCols;
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${cols}, var(--solution-cell))`;

    // 下の層：マスの場所（ピースのマスは透明、置けないマスは斜線）
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = document.createElement('div');
            cell.className = isNotPlaceableCell(row, col) ? 'solution-cell not-placeable' : 'solution-cell';
            container.appendChild(cell);
        }
    }

    // 上の層：ピース1つを1つの絵にして、覆っている数字と地雷も盤面と同じ形で描く
    // 画面に出す前に作るので、位置と大きさは実際のマスではなく CSS の値から決める
    const style = getComputedStyle(container);
    const cell = parseFloat(style.getPropertyValue('--solution-cell'));
    const gap = parseFloat(style.getPropertyValue('--board-gap'));
    const padding = parseFloat(style.paddingLeft);
    gameState.solution.forEach(placed => {
        const block = gameState.blocks[placed.blockIndex];
        const piece = document.createElement('div');
        piece.className = 'solution-piece';
        piece.style.setProperty('--piece-color', block.color);
        piece.style.left = `${padding + placed.col * (cell + gap)}px`;
        piece.style.top = `${padding + placed.row * (cell + gap)}px`;
        const getMark = (r, c) => getClueMark(placed.row + r, placed.col + c);
        piece.appendChild(createPieceSvg(block.grid, cell, gap, block.color, getMark));
        container.appendChild(piece);
    });
}

// 画面の大きさが変わったら（向きを変えたときなど）、表示中の想定解を描き直す
// マスの大きさは画面の高さで変わるが、ピースの絵の位置は描いたときの大きさで決めているため、そのままだとずれる
window.addEventListener('resize', () => {
    document.querySelectorAll('.modal.active .solution-board').forEach(board => {
        if (board.childElementCount > 0) renderSolutionBoard(board);
    });
});
