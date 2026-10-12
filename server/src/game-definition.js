/**
 * MINE BLOCKS のオンライン対戦（ゲームの定義）
 * 部屋の作成・参加・再接続・保存・送信などは netplay-kit の共通部品（server/netplay/）が行い、ここでは対戦の中身だけを決める
 *
 * 2〜4人が同じ問題を同時に解き、一番早く解いた人がその問題の勝ち。先に決めた勝ち数に届いた人が優勝
 * 問題は問題番号（シード）から各端末で作るので、サーバーは問題番号・開始時刻・結果だけを扱う
 * 問題の番号（round）で、前の問題の遅れた通知や二重の通知を黙って捨てる
 */

import { GameError } from '../netplay/room-service.js';

export const MIN_WINS = 1;
export const MAX_WINS = 5;
export const DEFAULT_WINS = 3;
export const COUNTDOWN_MS = 3000; // 問題を配ってから解き始めるまで（全員が同時に始められるように）
const MAX_SEED = 1000000;         // 問題番号の範囲（画面の「次の問題」と同じ6桁）

export default {
    minPlayers: 2,
    maxPlayers: 4,
    rematch: 'host',              // 試合のあとは、部屋を作った人が「開始」で再戦する（「部屋に戻る」は誰でも押せる）
    roomTtlSeconds: 24 * 60 * 60, // 部屋は最後の操作から1日で消える

    // ロビーの設定：勝ち抜けの数
    settings: {
        defaults: () => ({ winsNeeded: DEFAULT_WINS }),
        validate(patch, current) {
            const wins = Number(patch.winsNeeded ?? current.winsNeeded);
            if (!Number.isInteger(wins) || wins < MIN_WINS || wins > MAX_WINS) {
                throw new GameError(`勝ち数は${MIN_WINS}〜${MAX_WINS}で選んでください`);
            }
            return { ...current, winsNeeded: wins };
        }
    },

    // 試合を始める（勝ち数は試合ごとに0から）
    create({ players, settings, random, now }) {
        const game = { winsNeeded: settings.winsNeeded, wins: players.map(() => 0), phase: 'playing', round: null };
        startRound(game, 1, random, now, players.length);
        return game;
    },

    // 隠す情報はないので、全員に同じ状態を送る
    view: (game) => game,

    actions: {
        solved: (ctx) => finishPuzzle(ctx, 'solved'),
        surrender: (ctx) => finishPuzzle(ctx, 'surrendered'),

        // 次の問題へ（誰が押してもよい。同時に押されても、同じ問題の番号のときだけ進める）
        nextRound({ game, message, ignore, random, now, players }) {
            if (game.phase !== 'roundEnd' || game.round.number !== message.round) return ignore();
            startRound(game, game.round.number + 1, random, now(), players.length);
        }
    },

    // 誰かが勝ち数に届いたら試合終了
    isOver: (game) => game.wins.some(wins => wins >= game.winsNeeded),

    // まだ解いている人が切断・退出したら、残りの人を確かめる（誰もいなければ勝者なしで問題を終える）
    onPlayerGone(ctx) {
        if (!endRoundIfNobodyLeft(ctx)) ctx.ignore();
    }
};

function startRound(game, number, random, now, playerCount) {
    game.phase = 'playing';
    game.round = {
        number,
        seed: Math.floor(random() * MAX_SEED),
        startAt: now + COUNTDOWN_MS,
        results: Array.from({ length: playerCount }, () => null),
        winner: null,
        winnerTime: null
    };
}

// 解けた・降参した。一番早く解いた人がその問題の勝ち（タイムはサーバーの時計で測る）
function finishPuzzle(ctx, result) {
    const { game, seat, message } = ctx;
    if (game.phase !== 'playing' || game.round.number !== message.round || game.round.results[seat]) return ctx.ignore();

    const time = Math.max(0, ctx.now() - game.round.startAt);
    game.round.results[seat] = { result, time };
    if (result === 'solved') {
        game.wins[seat] += 1;
        game.round.winner = seat;
        game.round.winnerTime = time;
        game.phase = 'roundEnd';
    } else {
        endRoundIfNobodyLeft(ctx);
    }
}

// まだ解いている人（接続中で、解けても降参してもいない人）がいなくなったら、勝者なしで問題を終える
function endRoundIfNobodyLeft(ctx) {
    const game = ctx.game;
    if (game.phase !== 'playing') return false;
    const stillPlaying = ctx.players.some((player, seat) => ctx.isConnected(seat) && !game.round.results[seat]);
    if (stillPlaying) return false;
    game.phase = 'roundEnd';
    return true;
}
