/**
 * ソリューション管理モジュール
 * ゲームの解答（想定解）を生成する機能を提供します
 */

// 想定解と配置不可能なセルを生成
function generateSolutionAndNotPlaceableCells() {
    const size = gameState.boardSize;
    gameState.notPlaceableCells = [];
    
    // 空のソリューションボードを作成
    const solutionBoard = Array(size).fill().map(() => Array(size).fill(null));
    
    // 使用するブロック数を決定（生成したブロックの一部だけを使用）
    const totalBlocks = gameState.blocks.length; // 6個
    const blocksToUse = 4; // 実際に解答に使用するブロック数
    
    // すべてのブロックのインデックス配列をシャッフル
    const allBlockIndices = Array.from({ length: totalBlocks }, (_, i) => i);
    const shuffledBlockIndices = [...allBlockIndices].sort(() => 0.5 - Math.random());
    
    // 使用するブロックを選択（先頭からblocksToUse個）
    const selectedBlockIndices = shuffledBlockIndices.slice(0, blocksToUse);
    
    // 想定解を生成する（実際のパズルの解答を一つ生成）
    const placedBlocks = [];
    
    // 最初のブロックはランダムな位置に配置（最初のブロックは他のブロックと接する必要はない）
    let firstBlockPlaced = false;
    
    // 選択したブロックだけを使用して配置
    for (const blockIndex of selectedBlockIndices) {
        const block = gameState.blocks[blockIndex];
        
        // ブロックをボード上の適切な位置に配置できるか試みる
        let placed = false;
        
        // 最初のブロックの場合は、ランダムな位置に配置
        if (!firstBlockPlaced) {
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
                    firstBlockPlaced = true;
                }
            }
        } else {
            // 2つ目以降のブロックは、既存のブロックと接するように配置
            
            // 既に配置されたブロックの周囲のセルをチェック
            const adjacentPositions = findAdjacentPositions(solutionBoard, block.grid.length);
            
            // ランダム順にアクセス可能な隣接位置を試す
            const shuffledPositions = adjacentPositions.sort(() => 0.5 - Math.random());
            
            for (const position of shuffledPositions) {
                const startRow = position.row;
                const startCol = position.col;
                
                // このブロックをこの位置に配置できるかチェック
                if (canPlaceBlockOnSolution(startRow, startCol, block, solutionBoard)) {
                    // ブロックを配置
                    placeBlockOnSolution(startRow, startCol, blockIndex, block, solutionBoard);
                    placedBlocks.push({ row: startRow, col: startCol, blockIndex });
                    placed = true;
                    break;
                }
            }
        }
        
        // 配置できなかった場合、このブロックはスキップ（通常はここには来ないはず）
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

// ソリューションボードで既存のブロックに隣接する配置可能な位置を探す
function findAdjacentPositions(solutionBoard, blockSize) {
    const boardSize = solutionBoard.length;
    const adjacentPositions = [];
    
    // ボード上で既に配置済みのブロックの隣接セルを収集
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            // このセルが埋まっている場合、その上下左右を調べる
            if (solutionBoard[row][col] !== null) {
                // 上下左右の隣接セルをチェック
                const directions = [
                    { dr: -1, dc: 0 }, // 上
                    { dr: 1, dc: 0 },  // 下
                    { dr: 0, dc: -1 }, // 左
                    { dr: 0, dc: 1 }   // 右
                ];
                
                for (const { dr, dc } of directions) {
                    const adjacentRow = row + dr;
                    const adjacentCol = col + dc;
                    
                    // 隣接セルがボード上にあり、空いているかチェック
                    if (adjacentRow >= 0 && adjacentRow < boardSize && 
                        adjacentCol >= 0 && adjacentCol < boardSize && 
                        solutionBoard[adjacentRow][adjacentCol] === null) {
                        
                        // ブロックの左上隅の位置を計算（ブロックサイズを考慮）
                        for (let blockStartRow = Math.max(0, adjacentRow - blockSize + 1); 
                             blockStartRow <= adjacentRow && blockStartRow + blockSize <= boardSize; 
                             blockStartRow++) {
                             
                            for (let blockStartCol = Math.max(0, adjacentCol - blockSize + 1); 
                                 blockStartCol <= adjacentCol && blockStartCol + blockSize <= boardSize; 
                                 blockStartCol++) {
                                 
                                // 既に追加済みでないことを確認して追加
                                const existingPosition = adjacentPositions.find(
                                    pos => pos.row === blockStartRow && pos.col === blockStartCol
                                );
                                
                                if (!existingPosition) {
                                    adjacentPositions.push({ row: blockStartRow, col: blockStartCol });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    return adjacentPositions;
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