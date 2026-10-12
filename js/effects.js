/**
 * 演出モジュール
 * クリアしたときの盤面の波と紙吹雪を出します
 * 位置や向きは Math.random で決める（問題を作る乱数 random() を使うと、問題番号から作る問題が変わってしまうため）
 */

const CLEAR_EFFECT_MS = 900; // 演出を見せてからクリア画面を出すまで

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// クリアの演出：盤面のピースを左上から順に跳ねさせ、紙吹雪を出してから onDone を呼ぶ
function celebrateClear(onDone) {
    if (prefersReducedMotion()) {
        onDone();
        return;
    }

    const board = elements.gameBoard;
    board.querySelectorAll('.cell.filled').forEach(cell => {
        const delay = (Number(cell.dataset.row) + Number(cell.dataset.col)) * 35;
        cell.style.setProperty('--wave-delay', `${delay}ms`);
    });
    board.classList.add('cleared');
    spawnConfetti();

    setTimeout(() => {
        board.classList.remove('cleared');
        onDone();
    }, CLEAR_EFFECT_MS);
}

// 盤面の中央からピースの色の紙吹雪を飛ばす
function spawnConfetti(count = 48) {
    if (prefersReducedMotion()) return;

    const rect = elements.gameBoard.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti';
        const angle = Math.random() * Math.PI * 2;
        const distance = 90 + Math.random() * 170;
        piece.style.left = `${originX}px`;
        piece.style.top = `${originY}px`;
        piece.style.backgroundColor = PIECE_COLORS[i % PIECE_COLORS.length];
        piece.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
        piece.style.setProperty('--y', `${Math.sin(angle) * distance - 60}px`);
        piece.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
        piece.style.setProperty('--duration', `${0.9 + Math.random() * 0.5}s`);
        piece.addEventListener('animationend', () => piece.remove());
        // 裏のタブなどでアニメーションが進まず、終わりの合図が来ない場合も残さない
        setTimeout(() => piece.remove(), 2000);
        document.body.appendChild(piece);
    }
}
