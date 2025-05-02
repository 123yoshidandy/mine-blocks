/**
 * ブロック管理モジュール
 * ブロックの生成、描画、操作に関する機能を提供します
 */

// ブロックの形状を生成
function generateBlocks() {
    // ブロック生成数を6個に増加（ダミーを含む）
    const numBlocks = 6;
    
    for (let i = 0; i < numBlocks; i++) {
        // ブロックの形状をランダムに生成
        const blockSize = 2 + Math.floor(Math.random() * 2); // 2x2 または 3x3
        let block = Array(blockSize).fill().map(() => Array(blockSize).fill(0));
        
        // ブロックにランダムにセルを配置（最低2つ、最大blockSize*blockSize-1個）
        const minCells = 2;
        const maxCells = blockSize * blockSize - 1;
        const numCells = minCells + Math.floor(Math.random() * (maxCells - minCells + 1));
        
        let cellsPlaced = 0;
        while (cellsPlaced < numCells) {
            const row = Math.floor(Math.random() * blockSize);
            const col = Math.floor(Math.random() * blockSize);
            
            if (block[row][col] === 0) {
                block[row][col] = 1;
                cellsPlaced++;
            }
        }
        
        // ブロックが連結されているか確認
        if (!isConnected(block)) {
            // 連結されていない場合は作り直し
            i--;
            continue;
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

// ブロックが連結されているかチェック
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
                    
                    // デバッグ用: マインセルの背景色を変更して視覚的に識別しやすくする
                    cellElement.style.backgroundColor = '#e74c3c'; // 赤色でマインを表示
                    cellElement.style.color = 'white';
                    
                    // デバッグ用: マインの印を表示
                    cellElement.textContent = 'M';
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