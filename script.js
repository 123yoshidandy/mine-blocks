// ゲームの状態を管理するオブジェクト
const gameState = {
    level: 1,
    score: 0,
    board: [],
    blocks: [],
    selectedBlockIndex: -1,
    boardSize: 5, // デフォルトのボードサイズ
    solutions: [], // 複数の解答を保存
    foundSolutions: [] // プレイヤーが見つけた解答
};

// DOM要素の参照
const elements = {
    gameBoard: document.getElementById('gameBoard'),
    blocksContainer: document.getElementById('blocksContainer'),
    levelDisplay: document.getElementById('level'),
    scoreDisplay: document.getElementById('score'),
    currentScoreDisplay: document.getElementById('currentScore'),
    newGameButton: document.getElementById('newGame'),
    hintButton: document.getElementById('hint'),
    clearModal: document.getElementById('clearModal'),
    nextLevelButton: document.getElementById('nextLevel'),
    tryAnotherSolutionButton: document.getElementById('tryAnotherSolution')
};

// ゲーム初期化
function initGame() {
    gameState.level = 1;
    gameState.score = 0;
    updateStats();
    generateLevel();
    setupEventListeners();
}

// 統計情報の更新
function updateStats() {
    elements.levelDisplay.textContent = gameState.level;
    elements.scoreDisplay.textContent = gameState.score;
}

// レベル生成
function generateLevel() {
    // ボードサイズは難易度に応じて変更する可能性がある
    gameState.boardSize = 5 + Math.min(2, Math.floor(gameState.level / 5));
    
    // ブロックとボードをクリア
    clearBoard();
    
    // 新しいブロックを生成
    generateBlocks();
    
    // ボードを生成して描画
    generateBoard();
    renderBoard();
    
    // ブロックを描画
    renderBlocks();
    
    // 解答をリセット
    gameState.foundSolutions = [];
}

// ボードとブロックコンテナをクリア
function clearBoard() {
    elements.gameBoard.innerHTML = '';
    elements.blocksContainer.innerHTML = '';
    gameState.board = [];
    gameState.blocks = [];
    gameState.selectedBlockIndex = -1;
}

// ブロックの形状を生成
function generateBlocks() {
    // レベルに応じてブロックの数と複雑さを調整
    const numBlocks = 3 + Math.min(2, Math.floor(gameState.level / 3));
    
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
        
        // ブロックのセルの20%〜50%をマインにする
        const minMines = Math.max(1, Math.ceil(filledCells.length * 0.2));
        const maxMines = Math.ceil(filledCells.length * 0.5);
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
    
    // 解答を生成
    generateSolutions();
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

// ゲームボードを生成
function generateBoard() {
    const size = gameState.boardSize;
    gameState.board = Array(size).fill().map(() => Array(size).fill(null));
    
    // ボードのDOM構造を作成
    elements.gameBoard.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // ドロップ機能を追加
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragenter', handleDragEnter);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            
            // クリックイベントも維持
            cell.addEventListener('click', () => handleCellClick(row, col));
            
            elements.gameBoard.appendChild(cell);
        }
    }
}

// セルクリックのハンドラ
function handleCellClick(row, col) {
    if (gameState.selectedBlockIndex === -1) return;
    
    const block = gameState.blocks[gameState.selectedBlockIndex];
    const blockSize = block.grid.length;
    
    // ブロックをボードに配置できるかチェック
    if (canPlaceBlock(row, col, block)) {
        // ブロックを配置
        placeBlock(row, col, block);
        
        // ブロックを選択解除
        selectBlock(-1);
        
        // ボードが完成したかチェック
        checkBoardCompletion();
    }
}

// ドラッグオーバーのハンドラ
function handleDragOver(e) {
    // デフォルトの動作をキャンセルしてドロップを許可
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// ドラッグエンターのハンドラ
function handleDragEnter(e) {
    const cell = e.target.closest('.cell');
    if (cell) {
        cell.classList.add('drag-over');
    }
}

// ドラッグリーブのハンドラ
function handleDragLeave(e) {
    const cell = e.target.closest('.cell');
    if (cell) {
        cell.classList.remove('drag-over');
    }
}

// ドロップのハンドラ
function handleDrop(e) {
    e.preventDefault();
    
    const cell = e.target.closest('.cell');
    if (!cell) return;
    
    // ドラッグオーバースタイルを削除
    cell.classList.remove('drag-over');
    
    // ドロップ先のセル座標を取得
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    // ドラッグしていたブロックのインデックスを取得
    const blockIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    // 対応するブロックを取得
    if (blockIndex >= 0 && blockIndex < gameState.blocks.length) {
        // ブロックを選択状態にする
        selectBlock(blockIndex);
        
        // そのセルにブロックを配置
        const block = gameState.blocks[blockIndex];
        if (canPlaceBlock(row, col, block)) {
            placeBlock(row, col, block);
            selectBlock(-1);
            checkBoardCompletion();
        }
    }
}

// ブロックを配置できるかチェック
function canPlaceBlock(startRow, startCol, block) {
    const boardSize = gameState.boardSize;
    const blockSize = block.grid.length;
    
    // ボードの範囲外にはみ出ないかチェック
    if (startRow + blockSize > boardSize || startCol + blockSize > boardSize) {
        return false;
    }
    
    // 既に配置されているブロックと重ならないかチェック
    for (let row = 0; row < blockSize; row++) {
        for (let col = 0; col < blockSize; col++) {
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;
                
                if (gameState.board[boardRow][boardCol] !== null) {
                    return false;
                }
            }
        }
    }
    
    return true;
}

// ブロックをボードに配置
function placeBlock(startRow, startCol, block) {
    const blockSize = block.grid.length;
    const blockIndex = gameState.selectedBlockIndex;
    
    // ブロックをボードに配置
    for (let row = 0; row < blockSize; row++) {
        for (let col = 0; col < blockSize; col++) {
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;
                
                // マインかどうかをチェック
                const isMine = block.mines.some(mine => mine.row === row && mine.col === col);
                
                gameState.board[boardRow][boardCol] = {
                    blockIndex,
                    isMine
                };
                
                // DOM要素を更新
                const cellElement = document.querySelector(`.cell[data-row="${boardRow}"][data-col="${boardCol}"]`);
                cellElement.classList.add('filled');
                
                // マインの場合はマインクラスを追加し、マインの数を表示
                if (isMine) {
                    cellElement.classList.add('mine');
                    // マインの数値を表示 (セルに既に数字がある場合はその値を使用)
                    const currentValue = cellElement.textContent ? parseInt(cellElement.textContent) : 0;
                    // マインが置かれたセルの場合は、そのセルのマイン数を1増やす
                    cellElement.textContent = currentValue + 1;
                }
            }
        }
    }
    
    // ブロックを使用済みにする
    elements.blocksContainer.children[blockIndex].classList.add('used');
    elements.blocksContainer.children[blockIndex].style.pointerEvents = 'none';
    elements.blocksContainer.children[blockIndex].style.opacity = '0.5';
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

// ボードが完成したかチェック
function checkBoardCompletion() {
    const boardSize = gameState.boardSize;
    
    // 全てのブロックが使用されたかチェック
    const allBlocksUsed = gameState.blocks.every((_, index) => {
        return elements.blocksContainer.children[index].classList.contains('used');
    });
    
    if (!allBlocksUsed) return;
    
    // 各セルのマイン数をチェック
    let isValid = true;
    
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            const expectedMineCount = cell.textContent ? parseInt(cell.textContent) : 0;
            
            // セルが空でなく数字が表示されている場合
            if (expectedMineCount > 0) {
                // 実際に配置されたマインの数を確認
                const cellData = gameState.board[row][col];
                
                // セルにブロックが配置されていない場合はスキップ
                if (!cellData) continue;
                
                // この位置に配置されたマインの数をカウント
                let actualMineCount = 0;
                if (cellData.isMine) {
                    actualMineCount = 1;
                }
                
                // 期待するマイン数と実際のマイン数が一致しなければ不正解
                if (expectedMineCount !== actualMineCount) {
                    isValid = false;
                    break;
                }
            }
        }
        if (!isValid) break;
    }
    
    if (isValid) {
        // 現在のボード状態をシリアライズして解答として保存
        const currentSolution = JSON.stringify(gameState.board);
        
        // 既に見つけた解答かチェック
        if (!gameState.foundSolutions.includes(currentSolution)) {
            gameState.foundSolutions.push(currentSolution);
            
            // 別解を見つけた場合はポイント9倍
            const pointMultiplier = gameState.foundSolutions.length > 1 ? 9 : 1;
            const levelPoints = gameState.level * 100 * pointMultiplier;
            gameState.score += levelPoints;
            
            // 統計表示を更新
            updateStats();
            
            // クリアモーダルを表示
            elements.currentScoreDisplay.textContent = gameState.score;
            elements.clearModal.classList.add('active');
        }
    }
}

// ボードを描画
function renderBoard() {
    const size = gameState.boardSize;
    
    // 盤面にランダムに数字を配置 (これはヒントとして機能)
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            // 30%の確率で数字を表示
            if (Math.random() < 0.3) {
                // 1〜3の間の数字をランダムに表示 (パズルを解けるようにするため)
                const hintNumber = 1 + Math.floor(Math.random() * 3);
                const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                cell.textContent = hintNumber;
            }
        }
    }
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
        
        // ドラッグ機能を追加
        blockElement.setAttribute('draggable', 'true');
        blockElement.addEventListener('dragstart', handleDragStart);
        blockElement.addEventListener('dragend', handleDragEnd);
        
        // クリックイベントを追加
        blockElement.addEventListener('click', () => selectBlock(index));
        
        elements.blocksContainer.appendChild(blockElement);
    });
}

// ドラッグ関連の状態を保持するオブジェクト
const dragState = {
    isDragging: false,
    currentBlockIndex: -1,
};

// ドラッグ開始のハンドラ
function handleDragStart(e) {
    const blockElement = e.target.closest('.block');
    if (!blockElement) return;
    
    // ドラッグ中のブロックを選択状態にする
    const blockIndex = parseInt(blockElement.dataset.index);
    selectBlock(blockIndex);
    
    // ドラッグ中の状態を記録
    dragState.isDragging = true;
    dragState.currentBlockIndex = blockIndex;
    
    // ドラッグ中のブロック画像をセット
    e.dataTransfer.setData('text/plain', blockIndex);
    e.dataTransfer.effectAllowed = 'move';
    
    // ドラッグ中のブロックを半透明にする
    setTimeout(() => {
        blockElement.classList.add('dragging');
    }, 0);
}

// ドラッグ終了のハンドラ
function handleDragEnd(e) {
    const blockElement = e.target.closest('.block');
    if (!blockElement) return;
    
    // ドラッグ終了時の状態をリセット
    dragState.isDragging = false;
    blockElement.classList.remove('dragging');
}

// 解答を生成
function generateSolutions() {
    // ここでは実装を簡略化して、ゲームで生成されたブロックを使って
    // 複数の解答を見つけるアルゴリズムを実装する代わりに、
    // 現在のレベルではマインの数だけをボードに表示する簡易版を実装
    gameState.solutions = [];
    
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // 周囲のマイン設置予定地をカウント
        let count = 0;
        const size = gameState.boardSize;
        
        for (let r = Math.max(0, row - 1); r <= Math.min(size - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(size - 1, col + 1); c++) {
                if (r === row && c === col) continue;
                
                // 20%の確率でマインとしてカウント
                if (Math.random() < 0.2) {
                    count++;
                }
            }
        }
        
        // 40%の確率でヒントを表示
        if (Math.random() < 0.4 && count > 0) {
            cell.textContent = count;
        }
    });
}

// イベントリスナーのセットアップ
function setupEventListeners() {
    // 新しいゲームボタン
    elements.newGameButton.addEventListener('click', () => {
        gameState.level = 1;
        gameState.score = 0;
        updateStats();
        generateLevel();
    });
    
    // ヒントボタン
    elements.hintButton.addEventListener('click', () => {
        // ヒントを表示
        alert('ヒント: 数字はその位置に置かれるブロックに含まれるマインの数を表しています。各数字と一致するようにブロックを配置しましょう！');
    });
    
    // 次のレベルボタン
    elements.nextLevelButton.addEventListener('click', () => {
        gameState.level++;
        elements.clearModal.classList.remove('active');
        generateLevel();
    });
    
    // 別の解答を探すボタン
    elements.tryAnotherSolutionButton.addEventListener('click', () => {
        elements.clearModal.classList.remove('active');
        clearBoard();
        generateBoard();
        renderBoard();
        renderBlocks();
    });
}

// ゲームの開始
document.addEventListener('DOMContentLoaded', initGame);