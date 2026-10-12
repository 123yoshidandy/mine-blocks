/**
 * ボード管理モジュール
 * ゲームボードの生成、描画、状態チェックを行います
 */

// ゲームボードを生成
function generateBoard() {
    const rows = gameState.boardRows;
    const cols = gameState.boardCols;
    gameState.board = Array(rows).fill().map(() => Array(cols).fill(null));

    // ボードのDOM構造を作成
    elements.gameBoard.style.gridTemplateColumns = `repeat(${cols}, max-content)`;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
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
    // 配置済みのピースをクリックした場合は、そのピースを外して置き場に戻す
    const placed = gameState.board[row][col];
    if (placed !== null) {
        removeBlock(placed.blockIndex);
        return;
    }

    if (gameState.selectedBlockIndex === -1) return;

    const block = gameState.blocks[gameState.selectedBlockIndex];
    const origin = getBlockOrigin(row, col, block);

    // ブロックをボードに配置できるかチェック
    if (canPlaceBlock(origin.row, origin.col, block)) {
        // ブロックを配置
        placeBlock(origin.row, origin.col, block);
        
        // ブロックを選択解除
        selectBlock(-1);
        
        // ボードが完成したかチェック
        checkBoardCompletion();
    }
}

// カーソル位置のセルにピースの中心が来るときの、ピース左上の位置を返す
function getBlockOrigin(row, col, block) {
    return { row: row - block.anchor.row, col: col - block.anchor.col };
}

// ブロックを配置できるかチェック
function canPlaceBlock(startRow, startCol, block) {
    // ボードの範囲外にはみ出ないかチェック
    if (startRow < 0 || startCol < 0 ||
        startRow + block.rows > gameState.boardRows || startCol + block.cols > gameState.boardCols) {
        return false;
    }

    // 盤面のヒントとの一致を調べるため、ピースが覆うマイン（赤いマス）の数と数字を集める
    // マインは盤面にあるもので、ピース内部のマイン情報は問題生成のためだけに使う
    let coveredMines = 0;
    const coveredNumbers = [];

    // 既に配置されているブロックと重ならないか、配置不可能なセルと重ならないかチェック
    for (let row = 0; row < block.rows; row++) {
        for (let col = 0; col < block.cols; col++) {
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;

                if (gameState.board[boardRow][boardCol] !== null ||
                    isNotPlaceableCell(boardRow, boardCol)) {
                    return false;
                }

                const clue = getMineInfoFromSolution(boardRow, boardCol);
                if (clue.hasMine) {
                    coveredMines++;
                } else {
                    coveredNumbers.push(clue.mineCount);
                }
            }
        }
    }

    // ピースが覆う数字はすべて、ピースが含むマインの数と一致する必要がある
    return coveredNumbers.every(number => number === coveredMines);
}

// ブロックをボードに配置
function placeBlock(startRow, startCol, block) {
    const blockIndex = gameState.selectedBlockIndex;

    // ブロックをボードに配置
    for (let row = 0; row < block.rows; row++) {
        for (let col = 0; col < block.cols; col++) {
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;
                
                // マインかどうかをチェック（マインは盤面にあるもの）
                const isMine = getMineInfoFromSolution(boardRow, boardCol).hasMine;

                gameState.board[boardRow][boardCol] = {
                    blockIndex,
                    isMine
                };
                
                // DOM要素を更新
                const cellElement = document.querySelector(`.cell[data-row="${boardRow}"][data-col="${boardCol}"]`);
                // ピースの見た目は盤面の上に重ねる絵（addPieceOverlay）が受け持つ。マスには置いた印だけを付ける
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
    
    addPieceOverlay(blockIndex, startRow, startCol, block);

    // ブロックを使用済みにする
    const blockElement = elements.blocksContainer.children[blockIndex];
    blockElement.classList.add('used');
    
    // 非表示にする（置き場で他のピースの位置がずれないよう、場所は残す）
    blockElement.style.visibility = 'hidden';
    
    // 操作できないようにする（念のため）
    blockElement.style.pointerEvents = 'none';
}

// 配置済みのブロックを盤面から外し、置き場に戻す
function removeBlock(blockIndex) {
    for (let row = 0; row < gameState.boardRows; row++) {
        for (let col = 0; col < gameState.boardCols; col++) {
            const placed = gameState.board[row][col];
            if (placed === null || placed.blockIndex !== blockIndex) {
                continue;
            }

            gameState.board[row][col] = null;

            // ピースの色・つなぎ目を消し、置く前のヒント（数字・赤いマス）を表示し直す
            const cellElement = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            cellElement.classList.remove('filled', 'mine');
            renderCellClue(row, col);
        }
    }
    removePieceOverlay(blockIndex);

    // 置き場のブロックを再び表示する
    const blockElement = elements.blocksContainer.children[blockIndex];
    blockElement.classList.remove('used');
    blockElement.style.visibility = '';
    blockElement.style.pointerEvents = '';
}

// 盤面に置いたピースの絵（ピース1つを1つの SVG にして、マスの上に重ねる）
// マスごとに色を塗ると、動かしたときにつなぎ目に線が出るため、見た目はこの絵だけで描く
const pieceOverlays = new Map(); // blockIndex → { element, row, col, block }

function addPieceOverlay(blockIndex, row, col, block) {
    const element = document.createElement('div');
    element.className = 'piece-overlay';
    element.style.setProperty('--piece-color', block.color);
    const overlay = { element, row, col, block };
    pieceOverlays.set(blockIndex, overlay);
    elements.gameBoard.appendChild(element);
    layoutPieceOverlay(overlay);
}

function removePieceOverlay(blockIndex) {
    pieceOverlays.get(blockIndex)?.element.remove();
    pieceOverlays.delete(blockIndex);
}

// ピースの左上のマスの位置と、マスの大きさ・隙間を実際の盤面から測って、絵を作り直す
function layoutPieceOverlay({ element, row, col, block }) {
    const origin = elements.gameBoard.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    const gap = parseFloat(getComputedStyle(elements.gameBoard).columnGap) || 0;
    element.style.left = `${origin.offsetLeft}px`;
    element.style.top = `${origin.offsetTop}px`;
    element.replaceChildren(createPieceSvg(block.grid, origin.offsetWidth, gap, block.color));
}

// 画面の大きさが変わるとマスの大きさも変わるので、置いてあるピースの絵を作り直す
window.addEventListener('resize', () => pieceOverlays.forEach(layoutPieceOverlay));

// 同じピースの右・下・右下のマスとの隙間をピースの色で埋める影を返す（遊び方・想定解の小さな盤面で使う）
function getJoinShadow(grid, row, col) {
    const isFilled = (r, c) => grid[r] !== undefined && grid[r][c] === 1;
    const right = isFilled(row, col + 1);
    const down = isFilled(row + 1, col);
    const shadows = [];

    if (right) {
        shadows.push('var(--board-gap) 0 0 var(--piece-color)');
    }
    if (down) {
        shadows.push('0 var(--board-gap) 0 var(--piece-color)');
    }
    // 4マスが田の字に並ぶ場合は、隙間の交差部分も埋める
    if (right && down && isFilled(row + 1, col + 1)) {
        shadows.push('var(--board-gap) var(--board-gap) 0 var(--piece-color)');
    }

    return shadows.length > 0 ? shadows.join(', ') : 'none';
}

// ボードが完成したかチェック
function checkBoardCompletion() {
    const rows = gameState.boardRows;
    const cols = gameState.boardCols;

    // フィールドがすべて埋まっているかチェック
    let allCellsFilled = true;

    // 配置可能な全てのセルが埋まっているかチェック
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
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
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
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
        // オンライン対戦ではクリア画面を出さず、解けたことをサーバーに知らせる（勝敗は届いた順で決まる）
        if (isOnlineActive()) {
            onOnlinePuzzleSolved();
            return;
        }

        // チャレンジモードではクリア画面を出さず、持ち時間を加算して次の問題へ進む
        if (challengeState.active) {
            onChallengePuzzleSolved();
            return;
        }

        // タイマーを停止
        stopTimer();
        
        // クリア回数をカウントアップ
        gameState.clearedCount++;
        
        // クリアモーダルの内容を更新（クリア時間とクリア回数を表示）
        elements.clearTimeDisplay.textContent = gameState.elapsedTime;
        elements.clearCountResultDisplay.textContent = gameState.clearedCount;
        
        // 盤面の波と紙吹雪を見せてから、クリアモーダルを表示
        celebrateClear(() => elements.clearModal.classList.add('active'));
    }
}

// ボードを描画
function renderBoard() {
    // すべてのマスに数字またはマインを表示するように修正
    for (let row = 0; row < gameState.boardRows; row++) {
        for (let col = 0; col < gameState.boardCols; col++) {
            // 配置不可能なセルには数字を表示しない
            if (isNotPlaceableCell(row, col)) {
                continue;
            }

            renderCellClue(row, col);
        }
    }
}

// 1マス分のヒント（数字または赤いマス）を表示
function renderCellClue(row, col) {
    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);

    // ソリューションからマイン情報を取得
    const mineInfo = getMineInfoFromSolution(row, col);

    if (mineInfo.hasMine) {
        // マインがある場合は、数字ではなく色で表現（赤色はCSSの .solution-mine で指定）
        cell.classList.add('solution-mine');
        cell.textContent = '';  // 数字は表示しない
    } else if (mineInfo.mineCount > 0) {
        // マインがない場合は数字を表示（data-n で数ごとに色を変える）
        cell.textContent = mineInfo.mineCount;
        cell.dataset.n = mineInfo.mineCount;
    } else {
        // マインもなく、重なるブロックもない場合
        cell.textContent = '';
    }
}

// ソリューションからマイン情報を取得
function getMineInfoFromSolution(row, col) {
    // ソリューションがない場合
    if (!gameState.solution) {
        return { hasMine: false, mineCount: Math.floor(random() * 3) + 1 };
    }
    
    // この位置に重なるブロックとマイン情報を取得
    const solution = gameState.solution;
    let mineCount = 0;
    let hasMine = false;
    
    for (const placedBlock of solution) {
        const blockIndex = placedBlock.blockIndex;
        const block = gameState.blocks[blockIndex];

        // このブロックがこのセルをカバーしているかチェック
        let isCoveredByThisBlock = false;
        let isMineCellInThisBlock = false;

        for (let r = 0; r < block.rows; r++) {
            for (let c = 0; c < block.cols; c++) {
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