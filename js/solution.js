/**
 * ソリューション管理モジュール
 * ゲームの解答（想定解）を生成する機能を提供します
 */

// 想定解と配置不可能なセルを生成（すべてのブロックを配置できなければfalseを返す）
function generateSolutionAndNotPlaceableCells() {
    const size = gameState.boardSize;
    gameState.notPlaceableCells = [];
    
    // 空のソリューションボードを作成
    const solutionBoard = Array(size).fill().map(() => Array(size).fill(null));
    
    // 使用するブロック数を決定（生成したブロックの一部だけを使用）
    const totalBlocks = gameState.blocks.length; // 9個
    const blocksToUse = 6; // 実際に解答に使用するブロック数（残り3個はダミー）
    
    // すべてのブロックのインデックス配列をシャッフル
    const allBlockIndices = Array.from({ length: totalBlocks }, (_, i) => i);
    const shuffledBlockIndices = shuffle(allBlockIndices);
    
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
                const startRow = Math.floor(random() * (size - block.rows + 1));
                const startCol = Math.floor(random() * (size - block.cols + 1));
                
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
            const adjacentPositions = findAdjacentPositions(solutionBoard, block);
            
            // 既存のブロックと接する辺が多い位置から順に試す（接触数が同じ位置はランダム順）
            // ピース同士が密に接するほど、置ける範囲の外形から各ピースの形を読み取りにくくなる
            // sortは安定ソートなので、同じシードならどのブラウザでも同じ順になる
            const shuffledPositions = shuffle(adjacentPositions);
            const sortedPositions = shuffledPositions
                .map(position => ({
                    ...position,
                    contacts: countContacts(position.row, position.col, block, solutionBoard)
                }))
                .sort((a, b) => b.contacts - a.contacts);

            for (const position of sortedPositions) {
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
        
        // 配置できなかった場合は生成失敗（呼び出し側で作り直す）
        if (!placed) {
            return false;
        }
    }
    
    // ピースが1つもない外側の行・列を切り落とし、盤面を想定解が収まる最小の長方形にする
    let minRow = size, maxRow = -1, minCol = size, maxCol = -1;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (solutionBoard[row][col] !== null) {
                minRow = Math.min(minRow, row);
                maxRow = Math.max(maxRow, row);
                minCol = Math.min(minCol, col);
                maxCol = Math.max(maxCol, col);
            }
        }
    }
    gameState.boardRows = maxRow - minRow + 1;
    gameState.boardCols = maxCol - minCol + 1;

    // 生成されたソリューションを、切り落とした盤面の座標に合わせて保存
    gameState.solution = placedBlocks.map(placed => ({
        ...placed,
        row: placed.row - minRow,
        col: placed.col - minCol
    }));

    // 配置不可能なセルを設定
    // ソリューションで使用されていないセルを配置不可能にする
    for (let row = 0; row < gameState.boardRows; row++) {
        for (let col = 0; col < gameState.boardCols; col++) {
            if (solutionBoard[row + minRow][col + minCol] === null) {
                gameState.notPlaceableCells.push({ row, col });
            }
        }
    }

    return true;
}

// ソリューションボードで既存のブロックに隣接する配置可能な位置を探す
function findAdjacentPositions(solutionBoard, block) {
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
                        
                        // ブロックの左上隅の可能な位置を計算（ブロックサイズを考慮）
                        for (let blockStartRow = Math.max(0, adjacentRow - block.rows + 1);
                             blockStartRow <= adjacentRow && blockStartRow + block.rows <= boardSize;
                             blockStartRow++) {

                            for (let blockStartCol = Math.max(0, adjacentCol - block.cols + 1);
                                 blockStartCol <= adjacentCol && blockStartCol + block.cols <= boardSize;
                                 blockStartCol++) {
                                
                                // ブロックがこの位置に配置可能かチェック
                                if (canPlaceBlockOnSolution(blockStartRow, blockStartCol, block, solutionBoard)) {
                                    // 重要: ブロックを配置した場合に、実際に既存ブロックと隣接するかチェック
                                    if (wouldBlockBeAdjacentToExisting(blockStartRow, blockStartCol, block, solutionBoard)) {
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
        }
    }
    
    return adjacentPositions;
}

// ブロックが既存のブロックと隣接するかをチェック（埋まったセル同士が隣接するかを確認）
function wouldBlockBeAdjacentToExisting(startRow, startCol, block, solutionBoard) {
    const boardSize = solutionBoard.length;
    const directions = [
        { dr: -1, dc: 0 }, // 上
        { dr: 1, dc: 0 },  // 下
        { dr: 0, dc: -1 }, // 左
        { dr: 0, dc: 1 }   // 右
    ];

    // ブロックの各セルについて確認
    for (let row = 0; row < block.rows; row++) {
        for (let col = 0; col < block.cols; col++) {
            // このセルがブロックの一部（埋まっている）場合
            if (block.grid[row][col] === 1) {
                const boardRow = startRow + row;
                const boardCol = startCol + col;
                
                // この埋まったセルの隣接セルを確認
                for (const { dr, dc } of directions) {
                    const adjacentRow = boardRow + dr;
                    const adjacentCol = boardCol + dc;
                    
                    // 隣接セルがボード内かつ既に別のブロックが配置されているか確認
                    if (adjacentRow >= 0 && adjacentRow < boardSize && 
                        adjacentCol >= 0 && adjacentCol < boardSize && 
                        solutionBoard[adjacentRow][adjacentCol] !== null) {
                        return true; // 隣接している
                    }
                }
            }
        }
    }
    
    return false; // 隣接していない
}

// ソリューションボード上にブロックを配置できるかチェック
function canPlaceBlockOnSolution(startRow, startCol, block, solutionBoard) {
    const boardSize = solutionBoard.length;

    // ボードの範囲外にはみ出ないかチェック
    if (startRow + block.rows > boardSize || startCol + block.cols > boardSize) {
        return false;
    }

    // 既に配置されているブロックと重ならないかチェック
    for (let row = 0; row < block.rows; row++) {
        for (let col = 0; col < block.cols; col++) {
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
    for (let row = 0; row < block.rows; row++) {
        for (let col = 0; col < block.cols; col++) {
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
// ブロックをこの位置に置いたとき、既存のブロックと接する辺の数を返す
function countContacts(startRow, startCol, block, solutionBoard) {
    const boardSize = solutionBoard.length;
    const directions = [
        { dr: -1, dc: 0 }, // 上
        { dr: 1, dc: 0 },  // 下
        { dr: 0, dc: -1 }, // 左
        { dr: 0, dc: 1 }   // 右
    ];
    let contacts = 0;
    
    for (let row = 0; row < block.rows; row++) {
        for (let col = 0; col < block.cols; col++) {
            if (block.grid[row][col] !== 1) continue;
            
            for (const { dr, dc } of directions) {
                const adjacentRow = startRow + row + dr;
                const adjacentCol = startCol + col + dc;
                
                if (adjacentRow >= 0 && adjacentRow < boardSize &&
                    adjacentCol >= 0 && adjacentCol < boardSize &&
                    solutionBoard[adjacentRow][adjacentCol] !== null) {
                    contacts++;
                }
            }
        }
    }
    
    return contacts;
}
