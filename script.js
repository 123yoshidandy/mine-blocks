// ゲームの状態を管理するオブジェクト
const gameState = {
    score: 0,
    board: [],
    blocks: [],
    selectedBlockIndex: -1,
    boardSize: 6, // ボードサイズを6×6に固定
    notPlaceableCells: [], // 配置不可能なセル
    solution: null, // 想定解
    startTime: null, // ゲーム開始時間
    endTime: null, // ゲーム終了時間
    elapsedTime: 0, // 経過時間（秒）
    timerInterval: null // タイマーのインターバルID
};

// DOM要素の参照
const elements = {
    gameBoard: document.getElementById('gameBoard'),
    blocksContainer: document.getElementById('blocksContainer'),
    scoreDisplay: document.getElementById('score'),
    currentScoreDisplay: document.getElementById('currentScore'),
    earnedScoreDisplay: document.getElementById('earnedScore'),
    clearTimeDisplay: document.getElementById('clearTime'),
    timerDisplay: document.getElementById('timerDisplay'),
    newGameButton: document.getElementById('newGame'),
    hintButton: document.getElementById('hint'),
    clearModal: document.getElementById('clearModal'),
    nextGameButton: document.getElementById('nextGame')
};

// タッチ関連の状態を保持するオブジェクト
const touchState = {
    isTouching: false,
    selectedBlockIndex: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    isMoving: false,  // スワイプ中かどうかを示すフラグ
    targetCell: null  // 現在ターゲットしているセル
};

// ゲーム初期化
function initGame() {
    gameState.score = 0;
    updateStats();
    generateGame();
    setupEventListeners();
}

// 統計情報の更新
function updateStats() {
    elements.scoreDisplay.textContent = gameState.score;
}

// タイマーを開始
function startTimer() {
    // 既存のタイマーがあれば停止
    stopTimer();
    
    // 開始時間を記録
    gameState.startTime = new Date();
    gameState.elapsedTime = 0;
    
    // タイマーを開始（1秒ごとに更新）
    gameState.timerInterval = setInterval(() => {
        const now = new Date();
        gameState.elapsedTime = Math.floor((now - gameState.startTime) / 1000);
        
        // タイマー表示を更新（必要に応じて要素を追加）
        updateTimerDisplay();
    }, 1000);
}

// タイマーを停止
function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // 終了時間を記録（タイマーが動いている場合のみ）
    if (gameState.startTime) {
        gameState.endTime = new Date();
        // より正確な経過時間を計算
        gameState.elapsedTime = Math.floor((gameState.endTime - gameState.startTime) / 1000);
    }
}

// タイマー表示を更新
function updateTimerDisplay() {
    if (elements.timerDisplay) {
        elements.timerDisplay.textContent = gameState.elapsedTime;
    }
}

// 新しいゲームを生成
function generateGame() {
    // ブロックとボードをクリア
    clearBoard();
    
    // 新しいブロックを生成
    generateBlocks();
    
    // 想定解とそれに基づく配置不可能なセルを生成
    generateSolutionAndNotPlaceableCells();
    
    // ボードを生成して描画
    generateBoard();
    renderBoard();
    
    // ブロックを描画
    renderBlocks();
    
    // タイマーをリセットして開始
    startTimer();
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
    // 固定で4つのブロックを生成
    const numBlocks = 4;
    
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
        
        // 修正: マイン数を1以上、ブロックの大きさ（セル数）未満に設定
        const totalCells = filledCells.length;
        const minMines = 1; // 最低1つのマイン
        const maxMines = Math.max(1, totalCells - 1); // 最大でブロックのセル数-1個のマイン
        
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

            // ドラッグ操作に必要なイベントリスナーのみを追加（デスクトップ用）
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            
            // タッチイベントを追加（モバイル用）
            cell.addEventListener('touchstart', handleCellTouchStart);
            cell.addEventListener('touchmove', handleCellTouchMove);
            cell.addEventListener('touchend', handleCellTouchEnd);
            
            // クリックイベントを追加
            cell.addEventListener('click', () => handleCellClick(row, col));
            
            // 配置不可能なセルかどうかをチェック
            if (isNotPlaceableCell(row, col)) {
                cell.classList.add('not-placeable');
            }
            
            elements.gameBoard.appendChild(cell);
        }
    }
}

// 想定解と配置不可能なセルを生成
function generateSolutionAndNotPlaceableCells() {
    const size = gameState.boardSize;
    gameState.notPlaceableCells = [];
    
    // 空のソリューションボードを作成
    const solutionBoard = Array(size).fill().map(() => Array(size).fill(null));
    
    // 使用可能なブロックのインデックスを準備
    const availableBlocks = Array.from({ length: gameState.blocks.length }, (_, i) => i);
    
    // 想定解を生成する（実際のパズルの解答を一つ生成）
    const placedBlocks = [];
    
    // ブロックをランダムに配置し、ソリューションを生成
    while (availableBlocks.length > 0) {
        const blockIndex = availableBlocks.shift(); // 先頭のブロックを取得
        const block = gameState.blocks[blockIndex];
        
        // ブロックをボード上のランダムな位置に配置できるか試みる
        let placed = false;
        
        // ランダムな開始位置を試行 (最大100回)
        for (let attempt = 0; attempt < 100 && !placed; attempt++) {
            const startRow = Math.floor(Math.random() * (size - block.grid.length + 1));
            const startCol = Math.floor(Math.random() * (size - block.grid.length + 1));
            
            // このブロックをこの位置に配置できるかチェック
            if (canPlaceBlockOnSolution(startRow, startCol, block, solutionBoard)) {
                // ブロックを配置
                placeBlockOnSolution(startRow, startCol, blockIndex, block, solutionBoard);
                placedBlocks.push({ row: startRow, col: startCol, blockIndex });
                placed = true;
            }
        }
        
        // 配置できなかった場合、このブロックはスキップ
        // 実際のゲームでは全てのブロックを使用する必要があるため
        // このケースはありえないが、理論上はあり得る
        if (!placed) {
            console.warn('ブロック配置エラー：想定解の生成に失敗しました。');
        }
    }
    
    // 生成されたソリューションを保存
    gameState.solution = placedBlocks;
    
    // 配置不可能なセルを設定
    // ソリューションで使用されていないセルを配置不可能にする
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (solutionBoard[row][col] === null) {
                gameState.notPlaceableCells.push({ row, col });
            }
        }
    }
}

// ソリューションボード上にブロックを配置できるかチェック
function canPlaceBlockOnSolution(startRow, startCol, block, solutionBoard) {
    const boardSize = solutionBoard.length;
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
                
                if (solutionBoard[boardRow][boardCol] !== null) {
                    return false;
                }
            }
        }
    }
    
    return true;
}

// ソリューションボード上にブロックを配置
function placeBlockOnSolution(startRow, startCol, blockIndex, block, solutionBoard) {
    const blockSize = block.grid.length;
    
    for (let row = 0; row < blockSize; row++) {
        for (let col = 0; col < blockSize; col++) {
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;
                
                // マインかどうかをチェック
                const isMine = block.mines.some(mine => mine.row === row && mine.col === col);
                
                solutionBoard[boardRow][boardCol] = {
                    blockIndex,
                    isMine
                };
            }
        }
    }
}

// 特定のセルが配置不可能かどうかをチェック
function isNotPlaceableCell(row, col) {
    return gameState.notPlaceableCells.some(cell => cell.row === row && cell.col === col);
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

// ドラッグ関連の状態を保持するオブジェクト
const dragState = {
    isDragging: false,
    currentBlockIndex: -1,
    lastHoverRow: -1,
    lastHoverCol: -1,
    hoverCells: [] // ホバープレビュー中のセルを追跡
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
    dragState.lastHoverRow = -1;
    dragState.lastHoverCol = -1;
    dragState.hoverCells = [];
    
    // ドラッグ中のブロック画像をセット
    e.dataTransfer.setData('text/plain', blockIndex);
    e.dataTransfer.effectAllowed = 'move';
    
    // ブラウザのデフォルトドラッグ画像を非表示にする
    // 空の透明な要素を作成して、ドラッグ画像として設定
    const emptyElement = document.createElement('div');
    emptyElement.style.width = '1px';
    emptyElement.style.height = '1px';
    emptyElement.style.position = 'absolute';
    emptyElement.style.top = '-1000px';
    document.body.appendChild(emptyElement);
    
    // setDragImage(要素, X座標オフセット, Y座標オフセット)
    e.dataTransfer.setDragImage(emptyElement, 0, 0);
    
    // 次のイベントループで要素を削除
    setTimeout(() => {
        document.body.removeChild(emptyElement);
    }, 0);
}

// ドラッグ終了のハンドラ
function handleDragEnd(e) {
    const blockElement = e.target.closest('.block');
    if (!blockElement) return;
    
    // ドラッグ終了時の状態をリセット
    dragState.isDragging = false;
    
    // ホバープレビューをクリア
    clearHoverPreview();
}

// ドラッグオーバーのハンドラ
function handleDragOver(e) {
    // デフォルトの動作をキャンセルしてドロップを許可
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // ドラッグ中のブロックのプレビューを表示
    const cell = e.target.closest('.cell');
    if (cell && dragState.isDragging && dragState.currentBlockIndex !== -1) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // 同じセル上にとどまっている場合は再計算しない
        if (row === dragState.lastHoverRow && col === dragState.lastHoverCol) {
            return;
        }
        
        // 前回のホバープレビューをクリア
        clearHoverPreview();
        
        // 新しい位置にプレビューを表示
        dragState.lastHoverRow = row;
        dragState.lastHoverCol = col;
        showBlockPreview(row, col, gameState.blocks[dragState.currentBlockIndex]);
    }
}

// ドラッグエンターのハンドラ
function handleDragEnter(e) {
    // ホバープレビューがあるので、drag-overクラスは不要になりました
    // 何もしない
}

// ドラッグリーブのハンドラ
function handleDragLeave(e) {
    // ホバープレビューがあるので、drag-overクラスは不要になりました
    // 何もしない
}

// ドロップのハンドラ
function handleDrop(e) {
    e.preventDefault();
    
    const cell = e.target.closest('.cell');
    if (!cell) return;
    
    // ホバープレビューをクリア
    clearHoverPreview();
    
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

// ブロックのタッチ開始
function handleTouchStart(e) {
    // デフォルトのスクロール動作を防止
    e.preventDefault();
    
    const blockElement = e.target.closest('.block');
    if (!blockElement) return;
    
    // すでに使用済みのブロックは選択不可
    if (blockElement.classList.contains('used')) return;
    
    // タッチしたブロックを選択
    const blockIndex = parseInt(blockElement.dataset.index);
    selectBlock(blockIndex);
    
    // タッチ状態を記録
    touchState.isTouching = true;
    touchState.selectedBlockIndex = blockIndex;
    touchState.isMoving = false;
    
    // タッチ開始位置を記録
    const touch = e.touches[0];
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;
    touchState.lastX = touch.clientX;
    touchState.lastY = touch.clientY;
    
    // スワイプ操作のために、touchmoveイベントをbodyに追加
    document.body.addEventListener('touchmove', handleBodyTouchMove, { passive: false });
    document.body.addEventListener('touchend', handleBodyTouchEnd);
}

// ブロックのタッチ終了（ブロック上で終了した場合のみ）
function handleTouchEnd(e) {
    // タッチがブロック上で終了した場合は、ブロックの選択だけして配置はしない
    e.preventDefault();
}

// ボディ全体でのタッチ移動（スワイプ）
function handleBodyTouchMove(e) {
    // ブロックが選択されていない場合は通常のスクロールを許可
    if (gameState.selectedBlockIndex === -1) return;
    
    // デフォルト動作（スクロール）を防止
    e.preventDefault();
    
    // タッチ位置を取得
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    // 開始位置からある程度動いたらスワイプ操作と見なす
    const moveDist = Math.sqrt(Math.pow(x - touchState.startX, 2) + Math.pow(y - touchState.startY, 2));
    if (moveDist > 10) {
        touchState.isMoving = true;
    }
    
    // 前回の位置からほとんど動いていなければ処理をスキップ（パフォーマンス最適化）
    if (Math.abs(x - touchState.lastX) < 5 && Math.abs(y - touchState.lastY) < 5) {
        return;
    }
    
    // 現在位置を更新
    touchState.lastX = x;
    touchState.lastY = y;
    
    // タッチ位置の下にあるセルを取得
    const element = document.elementFromPoint(x, y);
    const cell = element ? element.closest('.cell') : null;
    
    if (cell) {
        touchState.targetCell = cell;
        
        // 前回のホバープレビューをクリア
        clearHoverPreview();
        
        // タッチ位置のセル座標を取得
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // 新しい位置にプレビューを表示
        if (!isNaN(row) && !isNaN(col)) {
            dragState.hoverCells = []; // ドラッグ状態の配列を使用
            showBlockPreview(row, col, gameState.blocks[gameState.selectedBlockIndex]);
        }
    }
}

// ボディ全体でのタッチ終了（スワイプ操作の終了）
function handleBodyTouchEnd(e) {
    // ブロックが選択されていない場合は何もしない
    if (gameState.selectedBlockIndex === -1) {
        touchState.isTouching = false;
        return;
    }
    
    // イベントリスナーを削除
    document.body.removeEventListener('touchmove', handleBodyTouchMove);
    document.body.removeEventListener('touchend', handleBodyTouchEnd);
    
    // スワイプ操作が行われ、かつターゲットセルがある場合
    if (touchState.isMoving && touchState.targetCell) {
        const row = parseInt(touchState.targetCell.dataset.row);
        const col = parseInt(touchState.targetCell.dataset.col);
        
        // ホバープレビューをクリア
        clearHoverPreview();
        
        // ブロックを配置
        const block = gameState.blocks[gameState.selectedBlockIndex];
        if (!isNaN(row) && !isNaN(col) && canPlaceBlock(row, col, block)) {
            placeBlock(row, col, block);
            selectBlock(-1);
            checkBoardCompletion();
        }
    }
    
    // タッチ状態をリセット
    touchState.isTouching = false;
    touchState.isMoving = false;
    touchState.targetCell = null;
}

// セルのタッチイベントは単純化（スワイプ操作はボディで処理するため）
function handleCellTouchStart(e) {
    // セル上でのタッチ開始は特に何もしない
}

function handleCellTouchMove(e) {
    // セル上でのタッチ移動は特に何もしない
}

function handleCellTouchEnd(e) {
    // セル上でのタッチ終了は特に何もしない
    // 代わりにボディ全体でのタッチ終了で処理
}

// ブロックのプレビューを表示
function showBlockPreview(startRow, startCol, block) {
    const blockSize = block.grid.length;
    const canPlace = canPlaceBlock(startRow, startCol, block);
    
    // ブロックのプレビューを表示
    for (let row = 0; row < blockSize; row++) {
        for (let col = 0; col < blockSize; col++) {
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;
                
                // ボード内かつ空いているセルのみ処理
                if (boardRow >= 0 && boardRow < gameState.boardSize && 
                    boardCol >= 0 && boardCol < gameState.boardSize) {
                    
                    const cellElement = document.querySelector(`.cell[data-row="${boardRow}"][data-col="${boardCol}"]`);
                    if (cellElement) {
                        // セルをホバープレビューリストに追加
                        dragState.hoverCells.push(cellElement);
                        
                        // ホバープレビュークラスを追加
                        cellElement.classList.add('hover-preview');
                        
                        // 配置できない場合は無効スタイルを追加
                        if (!canPlace) {
                            cellElement.classList.add('invalid');
                        }
                        
                        // マインセルの場合はマインクラスを追加
                        const isMine = block.mines.some(mine => mine.row === row && mine.col === col);
                        if (isMine) {
                            cellElement.classList.add('mine');
                        }
                    }
                }
            }
        }
    }
}

// ホバープレビューをクリア
function clearHoverPreview() {
    dragState.hoverCells.forEach(cell => {
        cell.classList.remove('hover-preview', 'invalid', 'mine');
    });
    dragState.hoverCells = [];
    dragState.lastHoverRow = -1;
    dragState.lastHoverCol = -1;
}

// ブロックを配置できるかチェック
function canPlaceBlock(startRow, startCol, block) {
    const boardSize = gameState.boardSize;
    const blockSize = block.grid.length;
    
    // ボードの範囲外にはみ出ないかチェック
    if (startRow + blockSize > boardSize || startCol + blockSize > boardSize) {
        return false;
    }
    
    // 既に配置されているブロックと重ならないか、配置不可能なセルと重ならないかチェック
    for (let row = 0; row < blockSize; row++) {
        for (let col = 0; col < blockSize; col++) {
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;
                
                if (gameState.board[boardRow][boardCol] !== null || 
                    isNotPlaceableCell(boardRow, boardCol)) {
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
                
                // マスに配置した場合は、数字やマイン表示を非表示にする
                cellElement.textContent = '';
                cellElement.style.backgroundColor = '';
                
                // 元々持っていたsolution-mineクラスがあれば削除
                cellElement.classList.remove('solution-mine');
                
                // マインの場合はマインクラスを追加するが、テキストは表示しない
                if (isMine) {
                    cellElement.classList.add('mine');
                }
            }
        }
    }
    
    // ブロックを使用済みにする
    const blockElement = elements.blocksContainer.children[blockIndex];
    blockElement.classList.add('used');
    
    // 完全に非表示にする（透明度を下げる代わりに）
    blockElement.style.display = 'none';
    
    // 操作できないようにする（念のため）
    blockElement.style.pointerEvents = 'none';
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
        // タイマーを停止
        stopTimer();
        
        // 時間に基づいたスコア計算
        // 300点から経過秒数を引く（最低10点）
        let timeScore = Math.max(10, 300 - gameState.elapsedTime);
        
        // クリアモーダルの内容を更新（経過時間と獲得スコアも表示）
        elements.clearTimeDisplay.textContent = gameState.elapsedTime;
        elements.earnedScoreDisplay.textContent = timeScore;
        
        // スコアを加算
        gameState.score += timeScore;
        elements.currentScoreDisplay.textContent = gameState.score;
        
        // 統計表示を更新
        updateStats();
        
        // クリアモーダルを表示
        elements.clearModal.classList.add('active');
    }
}

// ボードを描画
function renderBoard() {
    const size = gameState.boardSize;
    
    // すべてのマスに数字またはマインを表示するように修正
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            // 配置不可能なセルには数字を表示しない
            if (isNotPlaceableCell(row, col)) {
                continue;
            }
            
            const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            
            // ソリューションからマイン情報を取得
            const mineInfo = getMineInfoFromSolution(row, col);
            
            if (mineInfo.hasMine) {
                // マインがある場合は、数字ではなく色で表現
                cell.classList.add('solution-mine');
                cell.style.backgroundColor = '#e74c3c'; // 赤色でマインを表示
                cell.textContent = '';  // 数字は表示しない
            } else if (mineInfo.mineCount > 0) {
                // マインがない場合は数字を表示
                cell.textContent = mineInfo.mineCount;
            } else {
                // マインもなく、重なるブロックもない場合
                cell.textContent = '';
            }
        }
    }
}

// ソリューションからマイン情報を取得
function getMineInfoFromSolution(row, col) {
    // ソリューションがない場合
    if (!gameState.solution) {
        return { hasMine: false, mineCount: Math.floor(Math.random() * 3) + 1 };
    }
    
    // この位置に重なるブロックとマイン情報を取得
    const solution = gameState.solution;
    let mineCount = 0;
    let hasMine = false;
    
    for (const placedBlock of solution) {
        const blockIndex = placedBlock.blockIndex;
        const block = gameState.blocks[blockIndex];
        const blockSize = block.grid.length;
        
        // このブロックがこのセルをカバーしているかチェック
        let isCoveredByThisBlock = false;
        let isMineCellInThisBlock = false;
        
        for (let r = 0; r < blockSize; r++) {
            for (let c = 0; c < blockSize; c++) {
                if (block.grid[r][c] === 1) {
                    const boardRow = placedBlock.row + r;
                    const boardCol = placedBlock.col + c;
                    
                    // このセルに位置するかチェック
                    if (boardRow === row && boardCol === col) {
                        // マインかどうかをチェック
                        if (block.mines.some(mine => mine.row === r && mine.col === c)) {
                            hasMine = true;
                            isMineCellInThisBlock = true;
                        }
                        isCoveredByThisBlock = true;
                        break;
                    }
                }
            }
            if (isCoveredByThisBlock) break;
        }
        
        // このブロックがセルをカバーしている場合、ブロック全体のマイン数を加算
        if (isCoveredByThisBlock && !isMineCellInThisBlock) {
            // マインセルでない場合のみマイン数をカウント
            // ブロック全体のマイン数をカウント
            mineCount += block.mines.length;
        }
    }
    
    return { hasMine, mineCount };
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

// イベントリスナーのセットアップ
function setupEventListeners() {
    // 新しいゲームボタン
    elements.newGameButton.addEventListener('click', () => {
        gameState.score = 0;
        updateStats();
        generateGame();
    });
    
    // ヒントボタン
    elements.hintButton.addEventListener('click', () => {
        // ヒントを表示
        alert('ヒント: 数字はその位置に置かれるブロックに含まれるマインの数を表しています。各数字と一致するようにブロックを配置しましょう！');
    });
    
    // 次のゲームボタン
    elements.nextGameButton.addEventListener('click', () => {
        elements.clearModal.classList.remove('active');
        generateGame();
    });
}

// ゲームの開始
document.addEventListener('DOMContentLoaded', initGame);