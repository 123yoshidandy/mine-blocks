/**
 * ご意見・不具合の報告モジュール
 * フォームに書いた内容を入れた状態で、GitHub の Issue 作成画面を開きます
 * 遊んでいた問題の番号と端末の情報を添えて、不具合を再現しやすくします
 */

const FEEDBACK_ISSUE_URL = 'https://github.com/123yoshidandy/mine-blocks/issues/new';

const FEEDBACK_KINDS = {
    bug: '不具合',
    idea: 'ご意見・要望'
};

function setupFeedback() {
    elements.feedbackButton.addEventListener('click', openFeedback);
    elements.topFeedback.addEventListener('click', openFeedback);
    elements.feedbackClose.addEventListener('click', closeFeedback);
    elements.feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitFeedback();
    });

    // 背景のクリックや Esc キーでも閉じる
    elements.feedbackModal.addEventListener('click', (e) => {
        if (e.target === elements.feedbackModal) closeFeedback();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.feedbackModal.classList.contains('active')) closeFeedback();
    });
}

// フォームを開く（開いた時点の状況を添える内容として表示する）
function openFeedback() {
    elements.feedbackContext.textContent = getFeedbackContext().join('\n');
    elements.feedbackModal.classList.add('active');
}

function closeFeedback() {
    elements.feedbackModal.classList.remove('active');
}

// 遊んでいた状況（モード・問題の番号・画面の大きさ・ブラウザ）
function getFeedbackContext() {
    const isTop = !elements.topScreen.hidden;
    let mode = 'エンドレス';
    if (isTop) mode = 'トップ画面';
    else if (isOnlineActive()) mode = 'オンライン対戦';
    else if (challengeState.active) mode = 'チャレンジ';

    const lines = [`モード: ${mode}`];
    if (!isTop && gameState.seed !== null) lines.push(`問題番号: ${gameState.seed}`);
    lines.push(`画面: ${window.innerWidth}×${window.innerHeight}`);
    lines.push(`ブラウザ: ${navigator.userAgent}`);
    return lines;
}

// 書いた内容を入れた状態で、GitHub の Issue 作成画面を新しいタブで開く
function submitFeedback() {
    const kind = FEEDBACK_KINDS[elements.feedbackForm.elements.feedbackKind.value] || FEEDBACK_KINDS.bug;
    const summary = elements.feedbackTitle.value.trim();
    const detail = elements.feedbackBody.value.trim();

    const sections = [`### 内容\n${detail || '（なし）'}`];
    if (elements.feedbackAttach.checked) {
        sections.push(`### 遊んでいた状況\n${getFeedbackContext().map(line => `- ${line}`).join('\n')}`);
    }

    const params = new URLSearchParams({
        title: `[${kind}] ${summary}`,
        body: sections.join('\n\n')
    });
    window.open(`${FEEDBACK_ISSUE_URL}?${params}`, '_blank', 'noopener');

    elements.feedbackForm.reset();
    closeFeedback();
}
