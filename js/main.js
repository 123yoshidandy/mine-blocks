/**
 * メインモジュール
 * ゲームの初期化と全体のフロー管理を行います
 */

// 新しいゲームを生成（シード省略時は新しいシードを生成）
function generateGame(seed = generateSeed()) {
    // ボードとブロックをクリア
    clearBoard();

    // シードを設定（同じシードなら同じパズルになる）
    gameState.seed = seed;
    setSeed(seed);
    updateSeedDisplay();


    // ブロックと想定解（配置不可能なセルを含む）を生成
    // 想定解を作れなかった場合は、乱数列の続きを使って作り直す（同じシードなら結果も同じ）
    const maxAttempts = 100;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        gameState.blocks = [];
        generateBlocks();
        if (generateSolutionAndNotPlaceableCells()) {
            break;
        }
    }
    
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

    // URLにシードが指定されていればそのパズル、なければ今日の日付のパズルを生成
    const urlSeed = parseSeed(new URLSearchParams(location.search).get('seed'));
    generateGame(urlSeed ?? getDailySeed());
    setupEventListeners();
}

// DOMContentLoaded イベントでゲームを初期化
document.addEventListener('DOMContentLoaded', initGame);