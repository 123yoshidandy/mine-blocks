/**
 * ボード管理モジュール
 * ゲームボードの生成、描画、状態チェックを行います
 */

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

// 特定のセルが配置不可能かどうかをチェック
function isNotPlaceableCell(row, col) {
    return gameState.notPlaceableCells.some(cell => cell.row === row && cell.col === col);
}

// セルクリックのハンドラ
function handleCellClick(row, col) {
    if (gameState.selectedBlockIndex === -1) return;
    
    const block = gameState.blocks[gameState.selectedBlockIndex];
    
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

// ボードが完成したかチェック
function checkBoardCompletion() {
    const boardSize = gameState.boardSize;
    
    // フィールドがすべて埋まっているかチェック
    let allCellsFilled = true;
    
    // 配置可能な全てのセルが埋まっているかチェック
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            // 配置不可能なセルはスキップ
            if (isNotPlaceableCell(row, col)) {
                continue;
            }
            
            // セルが空いている場合はfalse
            if (gameState.board[row][col] === null) {
                allCellsFilled = false;
                break;
            }
        }
        if (!allCellsFilled) break;
    }
    
    // フィールドが埋まっていない場合は終了
    if (!allCellsFilled) return;
    
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
        
        // クリア回数をカウントアップ
        gameState.clearedCount++;
        
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