/**
 * 降参モジュール
 * 解けなかったときに降参し、結果画面で想定解を表示します
 */

// 降参ボタンと結果画面のボタンを準備する
function setupSurrender() {
    elements.surrenderButton.addEventListener('click', requestSurrender);
    elements.surrenderNextButton.addEventListener('click', () => {
        elements.surrenderModal.classList.remove('active');
        generateGame(getNextSeed(gameState.seed));
    });
}

// 誤って押したときのために確認してから降参する
function requestSurrender() {
    if (!window.confirm('降参して想定解を見ますか？')) return;
    surrender();
}

// タイマーを止め、想定解を結果画面に表示する（クリア回数には数えない）
function surrender() {
    stopTimer();
    selectBlock(-1);
    clearHoverPreview();

    renderSolutionBoard();
    elements.surrenderModal.classList.add('active');
}

// 想定解を小さな盤面に描く
// ピースの色でマスを塗り、数字は白、赤マスは赤い印で示す（置けないマスは斜線）
function renderSolutionBoard() {
    const rows = gameState.boardRows;
    const cols = gameState.boardCols;
    const container = elements.solutionBoard;
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${cols}, var(--solution-cell))`;

    // 各マスを覆うピースと、ピース内での位置を調べる
    const cover = Array(rows).fill().map(() => Array(cols).fill(null));
    gameState.solution.forEach(placed => {
        const block = gameState.blocks[placed.blockIndex];
        for (let r = 0; r < block.rows; r++) {
            for (let c = 0; c < block.cols; c++) {
                if (block.grid[r][c] === 1) {
                    cover[placed.row + r][placed.col + c] = { block, r, c };
                }
            }
        }
    });

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = document.createElement('div');
            const covered = cover[row][col];

            if (!covered) {
                cell.className = 'solution-cell not-placeable';
            } else {
                const mineInfo = getMineInfoFromSolution(row, col);
                cell.className = mineInfo.hasMine ? 'solution-cell on-mine' : 'solution-cell';
                cell.textContent = mineInfo.hasMine ? '' : mineInfo.mineCount;
                cell.style.setProperty('--piece-color', covered.block.color);
                // 盤面と同じく、同じピースのマス同士の隙間を埋める
                cell.style.boxShadow = getJoinShadow(covered.block.grid, covered.r, covered.c);
            }
            container.appendChild(cell);
        }
    }
}
