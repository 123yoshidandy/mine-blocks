/**
 * メインモジュール
 * ゲームの初期化と全体のフロー管理を行います
 */

// エンドレスに戻る：途中の問題なら作り直して続け、クリア・降参した問題なら新しい問題にする
// （答えを知っている問題をもう一度解いても意味がないため）
function resumeEndless() {
    const seed = gameState.endlessFinished || gameState.endlessSeed === null ? createRandomSeed() : gameState.endlessSeed;
    generateGame(seed);
}

// 指定したシードのゲームを生成
function generateGame(seed) {
    // ボードとブロックをクリア
    clearBoard();

    // シードを設定（同じシードなら同じパズルになる）
    gameState.seed = seed;

    // エンドレスの問題番号を覚えておき、チャレンジやオンライン対戦から戻ったときに再開する
    if (!challengeState.active && !isOnlineActive()) {
        gameState.endlessSeed = seed;
        gameState.endlessFinished = false;
    }
    setSeed(seed);

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

    // 以前の版で共有された問題番号つきのURL（?seed=）は使わないので、URLから外す
    const url = new URL(location.href);
    if (url.searchParams.has('seed')) {
        url.searchParams.delete('seed');
        history.replaceState(null, '', url);
    }

    // 毎回ランダムな問題で始める
    generateGame(createRandomSeed());
    setupEventListeners();
}

// DOMContentLoaded イベントでゲームを初期化
document.addEventListener('DOMContentLoaded', initGame);