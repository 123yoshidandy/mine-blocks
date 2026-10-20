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
    solved: 0,          // 解いた問題数
    deadline: 0,        // 時間切れになる時刻（ミリ秒）
    intervalId: null    // 残り時間表示を更新するインターバルID
};

// チャレンジを開始する（問題は毎回ランダム）
function startChallenge() {
    challengeState.active = true;
    challengeState.solved = 0;
    challengeState.deadline = Date.now() + CHALLENGE_INITIAL_TIME * 1000;

    elements.clearModal.classList.remove('active');
    elements.challengeModal.classList.remove('active');

    generateGame(createRandomSeed());
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

// チャレンジを終了してエンドレスモードに戻る（前の問題には戻らず、新しい問題にする）
function exitChallenge() {
    stopChallenge();
    generateGame(createRandomSeed());
}

// 1問解いたときの処理：持ち時間を加算して次の問題へ進む
function onChallengePuzzleSolved() {
    challengeState.solved++;
    challengeState.deadline += CHALLENGE_TIME_BONUS * 1000;

    generateGame(createRandomSeed());
    updateChallengeDisplay();
    showChallengeBonus();
    spawnConfetti(24); // すぐ次の問題に進むので、紙吹雪だけ出す
    playSound('bonus');
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

// チャレンジを終える（時間切れ・降参とも）：タイマーを止め、解いた数と最後の問題の想定解を表示する
function finishChallenge() {
    clearInterval(challengeState.intervalId);
    challengeState.intervalId = null;
    selectBlock(-1);
    clearHoverPreview();

    elements.challengeResult.textContent = challengeState.solved;
    renderSolutionBoard(elements.challengeSolutionBoard);
    elements.challengeModal.classList.add('active');
    playSound('timeUp');
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

    // 残り10秒以下は残り時間を赤く表示し、1秒ごとに時計の音で知らせる
    elements.remainingStat.classList.toggle('low', remaining <= 10);
    if (isChallengeRunning() && remaining <= 10 && remaining > 0 && remaining !== challengeState.lastTickSecond) {
        playSound('tick');
    }
    challengeState.lastTickSecond = remaining;
}

// モードに応じて、残り時間・解いた数の表示（チャレンジ中だけ）と降参ボタンの説明を切り替える
// チャレンジの開始はトップ画面から、終了はロゴでトップに戻るか結果画面から行う
function updateModeDisplay() {
    const isChallenge = challengeState.active;

    // チャレンジ中の降参はチャレンジの終了になることを、降参ボタンの説明で示す
    const surrenderLabel = isChallenge ? '降参してチャレンジを終了' : '降参して想定解を見る';
    elements.surrenderButton.title = surrenderLabel;
    elements.surrenderButton.setAttribute('aria-label', surrenderLabel);
    elements.challengeStats.hidden = !isChallenge;
}

