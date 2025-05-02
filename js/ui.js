/**
 * UI操作モジュール
 * ユーザーインターフェイス関連の処理を行います
 */

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