/**
 * メインモジュール
 * ゲームの初期化と全体のフロー管理を行います
 */

// 新しいゲームを生成
function generateGame() {
    // ボードとブロックをクリア
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

// ゲーム初期化
function initGame() {
    gameState.score = 0;
    gameState.clearedCount = 0;
    updateStats();
    generateGame();
    setupEventListeners();
}

// DOMContentLoaded イベントでゲームを初期化
document.addEventListener('DOMContentLoaded', initGame);