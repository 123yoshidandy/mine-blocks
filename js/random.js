/**
 * 乱数管理モジュール
 * シード値から再現可能な乱数を生成します（同じシードなら同じパズルになります）
 */

// ランダム生成するシードの上限（共有しやすいよう6桁に収める）
const MAX_RANDOM_SEED = 1000000;

// 受け付けるシードの上限（32bit符号なし整数）
const MAX_SEED = 4294967296;

// 乱数生成器の内部状態
let randomState = 0;

// シードを設定
function setSeed(seed) {
    randomState = seed >>> 0;
}

// 新しいシードをランダムに生成
function generateSeed() {
    return Math.floor(Math.random() * MAX_RANDOM_SEED);
}

// 今日の日付からシードを生成（例: 2026年10月11日 → 20261011）
// 同じ日に遊ぶ人は全員同じパズルになる
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

// 文字列からシードを読み取る（不正な値の場合はnull）
function parseSeed(value) {
    if (value === null || !/^\d+$/.test(value)) {
        return null;
    }
    const seed = parseInt(value, 10);
    return seed < MAX_SEED ? seed : null;
}

// 0以上1未満の乱数を返す（mulberry32）
function random() {
    randomState = (randomState + 0x6D2B79F5) >>> 0;
    let t = randomState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// 配列をシャッフルした新しい配列を返す（Fisher-Yates）
// sortを使ったシャッフルはブラウザごとに結果が異なるため使わない
function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
