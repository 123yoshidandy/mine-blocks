/**
 * インタラクション管理モジュール
 * ユーザーとのインタラクション（ドラッグ＆ドロップやタッチ操作）を管理します
 */

// ドラッグ関連の状態を保持するオブジェクト
const dragState = {
    isDragging: false,
    currentBlockIndex: -1,
    lastHoverRow: -1,
    lastHoverCol: -1,
    hoverCells: [] // ホバープレビュー中のセルを追跡
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

// セルのタッチイベント
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