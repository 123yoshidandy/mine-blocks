/**
 * メインモジュール
 * ゲームの初期化と全体のフロー管理を行います
 */

// 指定したシードのゲームを生成
function generateGame(seed) {
    // ボードとブロックをクリア
    clearBoard();

    // シードを設定（同じシードなら同じパズルになる）
    gameState.seed = seed;

    // エンドレスの問題番号を覚えておき、チャレンジやタイトルから戻ったときに再開する
    if (!challengeState.active) {
        gameState.endlessSeed = seed;
    }
    setSeed(seed);
    updateSeedUrl();


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
    gameState.clearedCount = 0;

    // URLにシードが指定されていればそのパズル、なければ今日の日付のパズルから始める
    const urlSeed = parseSeed(new URLSearchParams(location.search).get('seed'));
    // 以降は「新しいゲーム」「次のゲーム」でこのシードから決まった順に問題が続く
    // チャレンジモードもこの問題番号から始める
    gameState.initialSeed = urlSeed ?? getDailySeed();
    generateGame(gameState.initialSeed);
    setupEventListeners();
}

// DOMContentLoaded イベントでゲームを初期化
document.addEventListener('DOMContentLoaded', initGame);