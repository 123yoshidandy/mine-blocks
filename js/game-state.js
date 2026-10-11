/**
 * ゲーム状態管理モジュール
 * ゲームの状態を保持し、各種状態更新関数を提供します
 */

// ゲームの状態を管理するオブジェクト
const gameState = {
    clearedCount: 0, // クリア回数
    board: [],
    blocks: [],
    selectedBlockIndex: -1,
    boardSize: 7, // パズル生成に使う範囲のサイズ
    boardRows: 7, // 遊ぶ盤面の行数（想定解が収まる最小の長方形に切り落とした後）
    boardCols: 7, // 遊ぶ盤面の列数
    notPlaceableCells: [], // 配置不可能なセル
    solution: null, // 想定解
    seed: null, // パズル生成に使ったシード
    initialSeed: null, // ページを開いたときの問題番号（チャレンジモードの開始番号）
    endlessSeed: null, // 最後に遊んだエンドレスの問題番号（エンドレスに戻るときに再開する）
    startTime: null, // ゲーム開始時間
    endTime: null, // ゲーム終了時間
    elapsedTime: 0, // 経過時間（秒）
    timerInterval: null // タイマーのインターバルID
};

// DOM要素の参照
const elements = {
    gameBoard: document.getElementById('gameBoard'),
    blocksContainer: document.getElementById('blocksContainer'),
    clearCountResultDisplay: document.getElementById('clearCountResult'),
    clearTimeDisplay: document.getElementById('clearTime'),
    surrenderButton: document.getElementById('surrender'),
    surrenderModal: document.getElementById('surrenderModal'),
    solutionBoard: document.getElementById('solutionBoard'),
    surrenderNextButton: document.getElementById('surrenderNext'),
    hintButton: document.getElementById('hint'),
    shareButton: document.getElementById('share'),
    challengeToggleButton: document.getElementById('challengeToggle'),
    challengeStats: document.getElementById('challengeStats'),
    remainingStat: document.getElementById('remainingStat'),
    challengeSolved: document.getElementById('challengeSolved'),
    challengeTime: document.getElementById('challengeTime'),
    challengeBonus: document.getElementById('challengeBonus'),
    challengeModal: document.getElementById('challengeModal'),
    challengeResult: document.getElementById('challengeResult'),
    challengeRetryButton: document.getElementById('challengeRetry'),
    challengeExitButton: document.getElementById('challengeExit'),
    hintModal: document.getElementById('hintModal'),
    hintClose: document.getElementById('hintClose'),
    hintPrev: document.getElementById('hintPrev'),
    hintNext: document.getElementById('hintNext'),
    hintDots: document.getElementById('hintDots'),
    clearModal: document.getElementById('clearModal'),
    nextGameButton: document.getElementById('nextGame')
};

// URLの問題番号を更新（URLを共有すると同じパズルを遊べる）
function updateSeedUrl() {
    const url = new URL(location.href);
    url.searchParams.set('seed', gameState.seed);
    history.replaceState(null, '', url);
}

// タイマーを開始
function startTimer() {
    // 既存のタイマーがあれば停止
    stopTimer();
    
    // 開始時間を記録
    gameState.startTime = new Date();
    gameState.elapsedTime = 0;
    
    // タイマーを開始（1秒ごとに経過時間を更新、クリア時間の表示に使う）
    gameState.timerInterval = setInterval(() => {
        const now = new Date();
        gameState.elapsedTime = Math.floor((now - gameState.startTime) / 1000);
    }, 1000);
}

// タイマーを停止
function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // 終了時間を記録（タイマーが動いている場合のみ）
    if (gameState.startTime) {
        gameState.endTime = new Date();
        // より正確な経過時間を計算
        gameState.elapsedTime = Math.floor((gameState.endTime - gameState.startTime) / 1000);
    }
}

// ボードとブロックコンテナをクリア
function clearBoard() {
    elements.gameBoard.innerHTML = '';
    elements.blocksContainer.innerHTML = '';
    gameState.board = [];
    gameState.blocks = [];
    gameState.selectedBlockIndex = -1;
}