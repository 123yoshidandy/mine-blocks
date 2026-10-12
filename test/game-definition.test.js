import { describe, it, expect, beforeEach } from 'vitest';
import { createTestServer } from '../server/netplay/testing.js';
import game, { COUNTDOWN_MS, DEFAULT_WINS } from '../server/src/game-definition.js';

// 部屋を作り、勝ち数を決めて開始する
async function startMatch(names, winsNeeded = 2) {
    const server = createTestServer(game);
    const clients = await server.createRoom(names);
    await clients[0].send('setSettings', { settings: { winsNeeded } });
    await clients[0].send('start');
    return { server, clients };
}

const view = (client) => client.last('state').view;
const lobby = (client) => client.last('lobby');

describe('ロビー', () => {
    it('勝ち数の既定値は3で、部屋を作った人だけが1〜5で変えられる', async () => {
        const server = createTestServer(game);
        const [a, b] = await server.createRoom(['A', 'B']);
        expect(lobby(a).settings.winsNeeded).toBe(DEFAULT_WINS);

        await a.send('setSettings', { settings: { winsNeeded: 2 } });
        expect(lobby(b).settings.winsNeeded).toBe(2);

        await b.send('setSettings', { settings: { winsNeeded: 4 } });
        expect(b.last('error').code).toBe('not_host');

        await a.send('setSettings', { settings: { winsNeeded: 6 } });
        expect(a.last('error').message).toBe('勝ち数は1〜5で選んでください');
    });

    it('1人では始められず、5人目は満員で断られる', async () => {
        const server = createTestServer(game);
        const [a] = await server.createRoom(['A']);
        await a.send('start');
        expect(a.last('error').code).toBe('not_enough_players');

        const clients = await server.createRoom(['A', 'B', 'C', 'D', 'E']);
        expect(clients[4].last('error').code).toBe('room_full');
    });
});

describe('対戦', () => {
    let server;
    let a, b, c;
    beforeEach(async () => {
        ({ server, clients: [a, b, c] } = await startMatch(['A', 'B', 'C']));
    });

    it('開始すると全員に同じ問題番号と、3秒後の開始時刻が届く', async () => {
        expect(lobby(a).status).toBe('playing');
        expect(view(a).round.number).toBe(1);
        expect(view(a).round.seed).toBe(view(b).round.seed);
        expect(view(a).round.startAt).toBe(server.clock.now + COUNTDOWN_MS);
        expect(a.last('state').serverNow).toBe(server.clock.now);
    });

    it('最初に解いた人がその問題の勝ちになり、タイムは開始時刻から測る', async () => {
        server.clock.now += COUNTDOWN_MS + 12_345;
        await b.send('solved', { round: 1 });
        const state = view(a);
        expect(state.phase).toBe('roundEnd');
        expect(state.round.winner).toBe(1);
        expect(state.round.winnerTime).toBe(12_345);
        expect(state.wins).toEqual([0, 1, 0]);
    });

    it('2番目に解けた通知や、前の問題の遅れた通知は無視する', async () => {
        await b.send('solved', { round: 1 });
        await c.send('solved', { round: 1 });
        expect(view(a).wins).toEqual([0, 1, 0]);

        await a.send('nextRound', { round: 1 });
        await c.send('solved', { round: 1 });
        expect(view(a).round.number).toBe(2);
        expect(view(a).phase).toBe('playing');
        expect(view(a).wins).toEqual([0, 1, 0]);
    });

    it('次の問題へは誰でも進められ、同時に押されても1問だけ進む', async () => {
        await a.send('solved', { round: 1 });
        const firstSeed = view(a).round.seed;
        await c.send('nextRound', { round: 1 });
        await b.send('nextRound', { round: 1 });
        expect(view(a).round.number).toBe(2);
        expect(view(a).round.seed).not.toBe(firstSeed);
    });

    it('全員が降参したら、勝者なしで問題を終える', async () => {
        await a.send('surrender', { round: 1 });
        await b.send('surrender', { round: 1 });
        expect(view(a).phase).toBe('playing');
        await c.send('surrender', { round: 1 });
        expect(view(a).phase).toBe('roundEnd');
        expect(view(a).round.winner).toBeNull();
    });

    it('降参した人は、その問題ではもう勝てない', async () => {
        await a.send('surrender', { round: 1 });
        await a.send('solved', { round: 1 });
        expect(view(b).phase).toBe('playing');
        expect(view(b).wins).toEqual([0, 0, 0]);
    });

    it('残りの人が全員切断したら、勝者なしで問題を終える', async () => {
        await a.send('surrender', { round: 1 });
        await b.disconnect();
        await c.disconnect();
        expect(view(a).phase).toBe('roundEnd');
    });

    it('必要な勝ち数に届いたら試合終了。部屋に戻ると勝ち数が0から始まる', async () => {
        await c.send('solved', { round: 1 });
        await a.send('nextRound', { round: 1 });
        await c.send('solved', { round: 2 });
        expect(lobby(a).status).toBe('ended');
        expect(view(a).wins).toEqual([0, 0, 2]);

        await b.send('backToLobby');
        expect(lobby(a).status).toBe('lobby');
        await a.send('start');
        expect(view(b).wins).toEqual([0, 0, 0]);
        expect(view(b).round.number).toBe(1);
    });

    it('切断しても同じ席に戻れ、対戦中の問題が届く', async () => {
        await b.send('solved', { round: 1 });
        const b2 = await server.reconnect(b);
        expect(lobby(b2).seat).toBe(1);
        expect(view(b2).wins).toEqual([0, 1, 0]);
        expect(lobby(a).players[1].connected).toBe(true);
    });

    it('対戦中に部屋を作った人が退出しても、次の人が引き継ぐ', async () => {
        await a.send('leave');
        expect(a.last('left')).toBeTruthy();
        expect(lobby(b).players[0].left).toBe(true);
        expect(lobby(b).hostSeat).toBe(1);
    });
});
