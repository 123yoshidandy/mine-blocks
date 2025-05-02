/**
 * ブロック管理モジュール
 * ブロックの生成、描画、操作に関する機能を提供します
 */

// ブロックの形状を生成
function generateBlocks() {
    // ブロック生成数(ダミーを含む)
    const numBlocks = 6;
    
    for (let i = 0; i < numBlocks; i++) {
        // ブロックの形状をランダムに生成
        const blockSize = 3
        let block = Array(blockSize).fill().map(() => Array(blockSize).fill(0));
        
        // 連結を保証しながらセルを配置
        const minCells = 2;
        const maxCells = blockSize * blockSize - 1;
        const numCells = minCells + Math.floor(Math.random() * (maxCells - minCells + 1));
        
        // 最初のセルをランダムに配置
        let row = Math.floor(Math.random() * blockSize);
        let col = Math.floor(Math.random() * blockSize);
        block[row][col] = 1;
        
        // 連結セルの候補リスト（現在のセルに隣接する空のセル）
        let candidates = getAdjacentEmptyCells(block, row, col);
        let cellsPlaced = 1; // 最初のセルは既に配置済み
        
        // 必要なセル数に達するまで連結セルを追加
        while (cellsPlaced < numCells && candidates.length > 0) {
            // 候補リストからランダムに選択
            const randomIndex = Math.floor(Math.random() * candidates.length);
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
        
        // マインをランダムに配置（ブロックのセルの一部）
        const mines = [];
        const filledCells = [];
        
        for (let row = 0; row < blockSize; row++) {
            for (let col = 0; col < blockSize; col++) {
                if (block[row][col] === 1) {
                    filledCells.push({ row, col });
                }
            }
        }
        
        // 修正: マイン数を1以上、4以下、かつブロックの大きさ（セル数）未満に設定
        const totalCells = filledCells.length;
        const minMines = 1; // 最低1つのマイン
        const maxMines = Math.min(4, totalCells - 1); // 最大4個、ただしブロックのセル数-1個を超えない
        
        // マイン数をminとmaxの間でランダムに決定
        const numMines = minMines + Math.floor(Math.random() * (maxMines - minMines + 1));
        
        // ランダムにマインを配置
        const shuffled = [...filledCells].sort(() => 0.5 - Math.random());
        for (let j = 0; j < numMines; j++) {
            mines.push(shuffled[j]);
        }
        
        gameState.blocks.push({
            grid: block,
            mines: mines,
            size: blockSize
        });
    }
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
    const size = block.length;
    const visited = Array(size).fill().map(() => Array(size).fill(false));
    let count = 0;
    
    // 最初のセルを見つける
    let startRow = -1, startCol = -1;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
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
        if (row < 0 || row >= size || col < 0 || col >= size || 
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
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
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
        
        const size = block.grid.length;
        blockElement.style.setProperty('--cols', size);
        blockElement.style.setProperty('--rows', size);
        
        // ブロックのセルを描画
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
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