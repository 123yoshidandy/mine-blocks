/**
 * ブロック管理モジュール
 * ブロックの生成、描画、操作に関する機能を提供します
 */

// ピースの色（マインの赤や配置不可の灰色と区別できる色のみ、ピース数と同じ8色）
const PIECE_COLORS = [
    '#3498db', '#27ae60', '#9b59b6', '#f39c12', '#1abc9c', '#f1c40f',
    '#a0522d', '#a3cb38'
];

// ブロックの形状を生成（同じ形のピースは作り直す）
// 置き場ではマインが見えないため、同じ形が並ぶと見分けがつかず「置けるはずのピースが置けない」状態になる
function generateBlocks() {
    // ブロック生成数(ダミーを含む)
    const numBlocks = 8;
    const blockKeys = new Set();
    
    while (gameState.blocks.length < numBlocks) {
        const block = createRandomBlock();
        
        // 3×3の枠が必要な大きなピースは、形が特徴的で置き場所がほぼ1か所に決まり
        // ダミーなら形だけで見分けられて問題が易しくなるため、乱数列の続きで作り直す
        if (block.rows === 3 && block.cols === 3) {
            continue;
        }

        // 既存のピースと同じ形なら、乱数列の続きで作り直す
        const key = getBlockKey(block);
        if (blockKeys.has(key)) {
            continue;
        }
        blockKeys.add(key);
        
        block.color = PIECE_COLORS[gameState.blocks.length % PIECE_COLORS.length];
        gameState.blocks.push(block);
    }
}

// ピースの形から、ピースを比較するためのキーを作る
function getBlockKey(block) {
    return JSON.stringify(block.grid);
}

// ランダムな形とマインを持つピースを1つ生成
function createRandomBlock() {
    // ブロックの形状をランダムに生成
    const blockSize = 3
    let block = Array(blockSize).fill().map(() => Array(blockSize).fill(0));
    
    // 連結を保証しながらセルを配置
    const minCells = 2;
    const maxCells = blockSize * blockSize - 1;
    const numCells = minCells + Math.floor(random() * (maxCells - minCells + 1));
    
    // 最初のセルをランダムに配置
    let row = Math.floor(random() * blockSize);
    let col = Math.floor(random() * blockSize);
    block[row][col] = 1;
    
    // 連結セルの候補リスト（現在のセルに隣接する空のセル）
    let candidates = getAdjacentEmptyCells(block, row, col);
    let cellsPlaced = 1; // 最初のセルは既に配置済み
    
    // 必要なセル数に達するまで連結セルを追加
    while (cellsPlaced < numCells && candidates.length > 0) {
        // 候補リストからランダムに選択
        const randomIndex = Math.floor(random() * candidates.length);
        const nextCell = candidates[randomIndex];
        
        // 選択したセルを配置
        block[nextCell.row][nextCell.col] = 1;
        cellsPlaced++;
        
        // 候補リストを更新（選択したセルを削除し、その隣接セルを追加）
        candidates.splice(randomIndex, 1);
        const newCandidates = getAdjacentEmptyCells(block, nextCell.row, nextCell.col);
        
        // 重複を避けて候補リストに追加
        for (const newCell of newCandidates) {
            if (!candidates.some(c => c.row === newCell.row && c.col === newCell.col)) {
                candidates.push(newCell);
            }
        }
    }
    
    // 空の行・列を取り除き、ピースが収まる最小サイズにする（例: 2×2のピースは2×2の枠）
    block = trimToBoundingBox(block);
    const rows = block.length;
    const cols = block[0].length;
    
    // マインをランダムに配置（ブロックのセルの一部）
    const mines = [];
    const filledCells = [];
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (block[row][col] === 1) {
                filledCells.push({ row, col });
            }
        }
    }
    
    // マイン数をセル数の1/3〜1/2（切り捨て、最低1個）に設定
    // 盤面のマインが全体の3分の1程度になり、多すぎず少なすぎない
    // 例: 2〜3マス→1個、4〜5マス→1〜2個、6マス→2〜3個（いずれもマインでないマスが必ず残る）
    const totalCells = filledCells.length;
    const minMines = Math.max(1, Math.floor(totalCells / 3));
    const maxMines = Math.max(1, Math.floor(totalCells / 2));
    
    // マイン数をminとmaxの間でランダムに決定
    const numMines = minMines + Math.floor(random() * (maxMines - minMines + 1));
    
    // ランダムにマインを配置
    const shuffled = shuffle(filledCells);
    for (let j = 0; j < numMines; j++) {
        mines.push(shuffled[j]);
    }
    
    return {
        grid: block,
        mines: mines,
        rows: rows,
        cols: cols,
        anchor: getCenterCell(filledCells)
    };
}

// ピースの重心に最も近いマスを返す（ドラッグ・配置時にカーソルの下に来るマス）
function getCenterCell(filledCells) {
    const centerRow = filledCells.reduce((sum, cell) => sum + cell.row, 0) / filledCells.length;
    const centerCol = filledCells.reduce((sum, cell) => sum + cell.col, 0) / filledCells.length;
    return { row: Math.round(centerRow), col: Math.round(centerCol) };
}

// セルが埋まっている範囲だけを切り出したグリッドを返す
function trimToBoundingBox(grid) {
    let minRow = Infinity, maxRow = -1, minCol = Infinity, maxCol = -1;

    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            if (grid[row][col] === 1) {
                minRow = Math.min(minRow, row);
                maxRow = Math.max(maxRow, row);
                minCol = Math.min(minCol, col);
                maxCol = Math.max(maxCol, col);
            }
        }
    }

    return grid.slice(minRow, maxRow + 1).map(line => line.slice(minCol, maxCol + 1));
}

// 指定されたセルに隣接する空のセルを取得
function getAdjacentEmptyCells(block, row, col) {
    const size = block.length;
    const adjacentCells = [];
    const directions = [
        {dr: -1, dc: 0}, // 上
        {dr: 1, dc: 0},  // 下
        {dr: 0, dc: -1}, // 左
        {dr: 0, dc: 1}   // 右
    ];
    
    for (const dir of directions) {
        const newRow = row + dir.dr;
        const newCol = col + dir.dc;
        
        // 盤面内かつ空のセルであることを確認
        if (newRow >= 0 && newRow < size && 
            newCol >= 0 && newCol < size && 
            block[newRow][newCol] === 0) {
            adjacentCells.push({row: newRow, col: newCol});
        }
    }
    
    return adjacentCells;
}

// ブロックが連結されているかチェック（検証用に残しておく）
function isConnected(block) {
    const rows = block.length;
    const cols = block[0].length;
    const visited = Array(rows).fill().map(() => Array(cols).fill(false));
    let count = 0;

    // 最初のセルを見つける
    let startRow = -1, startCol = -1;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (block[row][col] === 1) {
                startRow = row;
                startCol = col;
                break;
            }
        }
        if (startRow !== -1) break;
    }
    
    if (startRow === -1) return false; // セルがない
    
    // DFSで連結を確認
    function dfs(row, col) {
        if (row < 0 || row >= rows || col < 0 || col >= cols ||
            visited[row][col] || block[row][col] === 0) {
            return;
        }
        
        visited[row][col] = true;
        count++;
        
        dfs(row + 1, col);
        dfs(row - 1, col);
        dfs(row, col + 1);
        dfs(row, col - 1);
    }
    
    dfs(startRow, startCol);
    
    // 全てのセルの数を数える
    let totalCells = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (block[row][col] === 1) {
                totalCells++;
            }
        }
    }
    
    return count === totalCells;
}

// ブロックを描画
function renderBlocks() {
    gameState.blocks.forEach((block, index) => {
        const blockElement = document.createElement('div');
        blockElement.className = 'block';
        blockElement.dataset.index = index;
        
        blockElement.style.setProperty('--piece-color', block.color);
        blockElement.style.setProperty('--cols', block.cols);
        blockElement.style.setProperty('--rows', block.rows);

        // ブロックのセルを描画
        for (let row = 0; row < block.rows; row++) {
            for (let col = 0; col < block.cols; col++) {
                const cellElement = document.createElement('div');
                cellElement.className = block.grid[row][col] === 1 ? 'block-cell' : 'block-cell empty';

                // マインの場合はマークを付ける
                if (block.mines.some(mine => mine.row === row && mine.col === col)) {
                    cellElement.classList.add('mine');
                }
                
                blockElement.appendChild(cellElement);
            }
        }
        
        // ドラッグ機能を追加（デスクトップ用）
        blockElement.setAttribute('draggable', 'true');
        blockElement.addEventListener('dragstart', handleDragStart);
        blockElement.addEventListener('dragend', handleDragEnd);
        
        // タッチイベントを追加（モバイル用）
        blockElement.addEventListener('touchstart', handleTouchStart);
        blockElement.addEventListener('touchend', handleTouchEnd);
        
        // クリックイベントを追加
        blockElement.addEventListener('click', () => selectBlock(index));
        
        elements.blocksContainer.appendChild(blockElement);
    });
}

// ブロックを選択
function selectBlock(index) {
    // 前の選択を解除
    if (gameState.selectedBlockIndex !== -1) {
        elements.blocksContainer.children[gameState.selectedBlockIndex].classList.remove('selected');
    }
    
    gameState.selectedBlockIndex = index;
    
    // 新しい選択を適用
    if (index !== -1) {
        elements.blocksContainer.children[index].classList.add('selected');
    }
}