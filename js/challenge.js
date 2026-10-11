/**
 * チャレンジモードモジュール
 * 持ち時間が尽きるまでに何問解けるかを競うモードを管理します
 * 1問解くごとに持ち時間が加算され、早く解いた分の残り時間は次の問題に持ち越されます
 */

// 開始時の持ち時間（秒）
const CHALLENGE_INITIAL_TIME = 60;

// 1問解くごとに加算する持ち時間（秒）
const CHALLENGE_TIME_BONUS = 20;

// チャレンジモードの状態
const challengeState = {
    active: false,      // チャレンジモード中かどうか（結果表示中も含む）
    startSeed: null,    // チャレンジを開始した問題番号（同じ番号から始めれば同じ問題の列になる）
    solved: 0,          // 解いた問題数
    deadline: 0,        // 時間切れになる時刻（ミリ秒）
    intervalId: null    // 残り時間表示を更新するインターバルID
};

// チャレンジを開始する
// ページを開いたときの問題番号から始めるので、同じ日（同じURL）なら誰でも同じ問題の列になる
function startChallenge() {
    challengeState.active = true;
    challengeState.startSeed = gameState.initialSeed;
    challengeState.solved = 0;
    challengeState.deadline = Date.now() + CHALLENGE_INITIAL_TIME * 1000;

    elements.clearModal.classList.remove('active');
    elements.challengeModal.classList.remove('active');

    generateGame(challengeState.startSeed);
    updateModeDisplay();
    updateChallengeDisplay();

    clearInterval(challengeState.intervalId);
    challengeState.intervalId = setInterval(tickChallenge, 200);
}

// チャレンジを止める（カウントダウンを止め、エンドレスの表示に戻す）
function stopChallenge() {
    clearInterval(challengeState.intervalId);
    challengeState.intervalId = null;
    challengeState.active = false;

    elements.challengeModal.classList.remove('active');
    updateModeDisplay();
}

// チャレンジを終了してエンドレスモードに戻る（チャレンジ開始前の問題から再開）
function exitChallenge() {
    stopChallenge();
    generateGame(gameState.endlessSeed ?? gameState.initialSeed);
}

// 1問解いたときの処理：持ち時間を加算して次の問題へ進む
function onChallengePuzzleSolved() {
    challengeState.solved++;
    challengeState.deadline += CHALLENGE_TIME_BONUS * 1000;

    generateGame(getNextSeed(gameState.seed));
    updateChallengeDisplay();
    showChallengeBonus();
}

// 残り時間の横に「+20秒」を表示する（続けて解いても毎回アニメーションを最初から再生する）
function showChallengeBonus() {
    const bonus = elements.challengeBonus;
    bonus.textContent = `+${CHALLENGE_TIME_BONUS}秒`;
    bonus.classList.remove('show');
    void bonus.offsetWidth; // クラスを付け直してもアニメーションが再生されるよう、再描画させる
    bonus.classList.add('show');
}

// 残り時間を確認し、時間切れなら結果を表示する
function tickChallenge() {
    updateChallengeDisplay();

    if (Date.now() >= challengeState.deadline) {
        finishChallenge();
    }
}

// 時間切れ：タイマーを止めて結果を表示する
function finishChallenge() {
    clearInterval(challengeState.intervalId);
    challengeState.intervalId = null;
    stopTimer();

    // 降参して想定解を見ている間に時間切れになった場合は、想定解を閉じて結果を出す
    elements.surrenderModal.classList.remove('active');
    elements.challengeResult.textContent = challengeState.solved;
    elements.challengeModal.classList.add('active');
}

// チャレンジのカウントダウン中かどうか（時間切れ後の結果表示中は含まない）
function isChallengeRunning() {
    return challengeState.active && challengeState.intervalId !== null;
}

// 残り秒数を返す（切り上げ、0未満にはしない）
function getChallengeRemainingSeconds() {
    return Math.max(0, Math.ceil((challengeState.deadline - Date.now()) / 1000));
}

// 残り時間と解いた数の表示を更新
function updateChallengeDisplay() {
    const remaining = getChallengeRemainingSeconds();
    elements.challengeTime.textContent = remaining;
    elements.challengeSolved.textContent = challengeState.solved;

    // 残り10秒以下は残り時間を赤く表示して知らせる
    elements.remainingStat.classList.toggle('low', remaining <= 10);
}

// モードに応じてチャレンジボタンと、残り時間・解いた数の表示（チャレンジ中だけ）を切り替える
// チャレンジボタンはチャレンジ中だけ強調し、押すとエンドレスに戻ることを説明文で示す
function updateModeDisplay() {
    const isChallenge = challengeState.active;
    const button = elements.challengeToggleButton;
    const label = isChallenge ? 'チャレンジを終了してエンドレスに戻る' : 'チャレンジモード';
    button.classList.toggle('active', isChallenge);
    button.setAttribute('aria-pressed', isChallenge);
    button.title = label;
    button.setAttribute('aria-label', label);
    elements.challengeStats.hidden = !isChallenge;
}

// チャレンジ中にエンドレスへ切り替えるときは確認する（時間切れ後の結果表示中は確認しない）
function requestExitChallenge() {
    if (!challengeState.active) return;

    if (isChallengeRunning() && !window.confirm('チャレンジを終了してエンドレスに戻りますか？')) {
        return;
    }
    exitChallenge();
}
