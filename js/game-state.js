/**
 * ゲーム状態管理モジュール
 * ゲームの状態を保持し、各種状態更新関数を提供します
 */

// ゲームの状態を管理するオブジェクト
const gameState = {
    score: 0,
    clearedCount: 0, // クリア回数
    board: [],
    blocks: [],
    selectedBlockIndex: -1,
    boardSize: 7, // ボードサイズ
    notPlaceableCells: [], // 配置不可能なセル
    solution: null, // 想定解
    startTime: null, // ゲーム開始時間
    endTime: null, // ゲーム終了時間
    elapsedTime: 0, // 経過時間（秒）
    timerInterval: null // タイマーのインターバルID
};

// DOM要素の参照
const elements = {
    gameBoard: document.getElementById('gameBoard'),
    blocksContainer: document.getElementById('blocksContainer'),
    scoreDisplay: document.getElementById('score'),
    clearCountDisplay: document.getElementById('clearCount'),
    currentScoreDisplay: document.getElementById('currentScore'),
    earnedScoreDisplay: document.getElementById('earnedScore'),
    clearTimeDisplay: document.getElementById('clearTime'),
    timerDisplay: document.getElementById('timerDisplay'),
    newGameButton: document.getElementById('newGame'),
    hintButton: document.getElementById('hint'),
    clearModal: document.getElementById('clearModal'),
    nextGameButton: document.getElementById('nextGame')
};

// 統計情報の更新
function updateStats() {
    elements.scoreDisplay.textContent = gameState.score;
    elements.clearCountDisplay.textContent = gameState.clearedCount;
}

// タイマーを開始
function startTimer() {
    // 既存のタイマーがあれば停止
    stopTimer();
    
    // 開始時間を記録
    gameState.startTime = new Date();
    gameState.elapsedTime = 0;
    
    // タイマーを開始（1秒ごとに更新）
    gameState.timerInterval = setInterval(() => {
        const now = new Date();
        gameState.elapsedTime = Math.floor((now - gameState.startTime) / 1000);
        
        // タイマー表示を更新
        updateTimerDisplay();
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

// タイマー表示を更新
function updateTimerDisplay() {
    if (elements.timerDisplay) {
        elements.timerDisplay.textContent = gameState.elapsedTime;
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