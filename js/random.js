/**
 * 乱数管理モジュール
 * シード値から再現可能な乱数を生成します（同じシードなら同じパズルになります）
 * エンドレスとチャレンジは毎回ランダムなシードで問題を作り、オンライン対戦ではサーバーが配るシードで全員が同じ問題を作る
 */

// シードの上限（32bit符号なし整数）
const MAX_SEED = 4294967296;

// 乱数生成器の内部状態
let randomState = 0;

// シードを設定
function setSeed(seed) {
    randomState = seed >>> 0;
}

// 新しい問題のシードをランダムに決める（エンドレス・チャレンジ用）
function createRandomSeed() {
    return Math.floor(Math.random() * MAX_SEED);
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
