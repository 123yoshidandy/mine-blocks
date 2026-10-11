import { describe, it, expect, beforeEach } from 'vitest';
import { RoomService, COUNTDOWN_MS, DEFAULT_WINS } from '../server/src/room-service.js';
import { MemoryStore } from '../server/src/memory-store.js';

// 端末ごとに届いたメッセージを記録し、時刻と乱数を固定した部屋の処理を作る
function setup() {
    const inbox = new Map();
    const clock = { now: 1_000_000 };
    let tokenCount = 0;
    let randomValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    let randomIndex = 0;
    const store = new MemoryStore();
    const service = new RoomService({
        store,
        send: async (connectionId, message) => {
            if (!inbox.has(connectionId)) inbox.set(connectionId, []);
            inbox.get(connectionId).push(message);
        },
        createToken: () => `token-${++tokenCount}`,
        now: () => clock.now,
        random: () => randomValues[randomIndex++ % randomValues.length]
    });
    const last = (connectionId, type) => [...(inbox.get(connectionId) ?? [])].reverse().find(message => message.type === type);
    return { service, store, inbox, clock, last };
}

// 部屋を作り、ほかの人を参加させる
async function createRoomWith(ctx, names) {
    await ctx.service.handle('c0', { action: 'create', name: names[0] });
    const code = ctx.last('c0', 'joined').roomCode;
    for (let i = 1; i < names.length; i++) {
        await ctx.service.handle(`c${i}`, { action: 'join', roomCode: code, name: names[i] });
    }
    return code;
}

describe('部屋の作成と参加', () => {
    let ctx;
    beforeEach(() => { ctx = setup(); });

    it('部屋を作ると5桁の部屋番号と席0が返る', async () => {
        await ctx.service.handle('c0', { action: 'create', name: 'あお' });
        const joined = ctx.last('c0', 'joined');
        expect(joined.roomCode).toMatch(/^\d{5}$/);
        expect(joined.seat).toBe(0);
        const room = ctx.last('c0', 'room').room;
        expect(room.status).toBe('lobby');
        expect(room.winsNeeded).toBe(DEFAULT_WINS);
        expect(room.players.map(p => p.name)).toEqual(['あお']);
    });

    it('参加すると全員に参加者が届き、5人目は満員で断られる', async () => {
        const code = await createRoomWith(ctx, ['A', 'B', 'C', 'D']);
        expect(ctx.last('c0', 'room').room.players.map(p => p.name)).toEqual(['A', 'B', 'C', 'D']);
        expect(ctx.last('c3', 'room').seat).toBe(3);

        await ctx.service.handle('c4', { action: 'join', roomCode: code, name: 'E' });
        expect(ctx.last('c4', 'error').message).toBe('この部屋は満員です');
    });

    it('存在しない部屋には入れない', async () => {
        await ctx.service.handle('c9', { action: 'join', roomCode: '00000', name: 'X' });
        expect(ctx.last('c9', 'error').message).toBe('部屋が見つかりません');
    });

    it('名前は12文字までで、空なら「プレイヤー」になる', async () => {
        await ctx.service.handle('c0', { action: 'create', name: '  ' });
        expect(ctx.last('c0', 'room').room.players[0].name).toBe('プレイヤー');
        const code = ctx.last('c0', 'joined').roomCode;
        await ctx.service.handle('c1', { action: 'join', roomCode: code, name: 'あいうえおかきくけこさしすせそ' });
        expect(ctx.last('c1', 'room').room.players[1].name).toBe('あいうえおかきくけこさし');
    });
});

describe('ロビーの設定と開始', () => {
    let ctx;
    beforeEach(() => { ctx = setup(); });

    it('勝ち数は部屋を作った人だけが1〜5で変えられる', async () => {
        await createRoomWith(ctx, ['A', 'B']);
        await ctx.service.handle('c0', { action: 'setWinsNeeded', winsNeeded: 2 });
        expect(ctx.last('c1', 'room').room.winsNeeded).toBe(2);

        await ctx.service.handle('c1', { action: 'setWinsNeeded', winsNeeded: 4 });
        expect(ctx.last('c1', 'error').message).toBe('部屋を作った人だけが操作できます');

        await ctx.service.handle('c0', { action: 'setWinsNeeded', winsNeeded: 6 });
        expect(ctx.last('c0', 'error').message).toBe('勝ち数は1〜5で選んでください');
    });

    it('1人では始められない', async () => {
        await createRoomWith(ctx, ['A']);
        await ctx.service.handle('c0', { action: 'start' });
        expect(ctx.last('c0', 'error').message).toBe('2人以上で始めてください');
    });

    it('開始すると全員に同じ問題番号と開始時刻（3秒後）が届く', async () => {
        await createRoomWith(ctx, ['A', 'B']);
        await ctx.service.handle('c0', { action: 'start' });
        const a = ctx.last('c0', 'room');
        const b = ctx.last('c1', 'room');
        expect(a.room.status).toBe('playing');
        expect(a.room.round.number).toBe(1);
        expect(a.room.round.seed).toBe(b.room.round.seed);
        expect(a.room.round.startAt).toBe(ctx.clock.now + COUNTDOWN_MS);
        expect(a.serverNow).toBe(ctx.clock.now);
    });

    it('対戦が始まった部屋には新しく入れない', async () => {
        const code = await createRoomWith(ctx, ['A', 'B']);
        await ctx.service.handle('c0', { action: 'start' });
        await ctx.service.handle('c2', { action: 'join', roomCode: code, name: 'C' });
        expect(ctx.last('c2', 'error').message).toBe('この部屋は対戦が始まっています');
    });
});

describe('対戦', () => {
    let ctx;
    beforeEach(async () => {
        ctx = setup();
        await createRoomWith(ctx, ['A', 'B', 'C']);
        await ctx.service.handle('c0', { action: 'setWinsNeeded', winsNeeded: 2 });
        await ctx.service.handle('c0', { action: 'start' });
    });

    it('最初に解いた人がその問題の勝ちになり、タイムは開始時刻から測る', async () => {
        ctx.clock.now += COUNTDOWN_MS + 12_345;
        await ctx.service.handle('c1', { action: 'solved', round: 1 });
        const room = ctx.last('c0', 'room').room;
        expect(room.status).toBe('roundEnd');
        expect(room.round.winner).toBe(1);
        expect(room.round.winnerTime).toBe(12_345);
        expect(room.players.map(p => p.wins)).toEqual([0, 1, 0]);
    });

    it('2番目に解けた通知や、前の問題の遅れた通知は無視する', async () => {
        await ctx.service.handle('c1', { action: 'solved', round: 1 });
        await ctx.service.handle('c2', { action: 'solved', round: 1 });
        await ctx.service.handle('c1', { action: 'solved', round: 1 });
        expect(ctx.last('c0', 'room').room.players.map(p => p.wins)).toEqual([0, 1, 0]);

        await ctx.service.handle('c0', { action: 'nextRound', round: 1 });
        await ctx.service.handle('c2', { action: 'solved', round: 1 });
        const room = ctx.last('c0', 'room').room;
        expect(room.status).toBe('playing');
        expect(room.round.number).toBe(2);
        expect(room.players.map(p => p.wins)).toEqual([0, 1, 0]);
    });

    it('次の問題へは誰でも進められ、同時に押されても1問だけ進む', async () => {
        await ctx.service.handle('c0', { action: 'solved', round: 1 });
        const firstSeed = ctx.last('c0', 'room').room.round.seed;
        await ctx.service.handle('c2', { action: 'nextRound', round: 1 });
        await ctx.service.handle('c1', { action: 'nextRound', round: 1 });
        const round = ctx.last('c0', 'room').room.round;
        expect(round.number).toBe(2);
        expect(round.seed).not.toBe(firstSeed);
        expect(round.results).toEqual([null, null, null]);
    });

    it('降参した人がいても、残りの人が解き続けられる。全員降参なら勝者なしで終わる', async () => {
        await ctx.service.handle('c0', { action: 'surrender', round: 1 });
        await ctx.service.handle('c1', { action: 'surrender', round: 1 });
        expect(ctx.last('c0', 'room').room.status).toBe('playing');

        await ctx.service.handle('c2', { action: 'surrender', round: 1 });
        const room = ctx.last('c0', 'room').room;
        expect(room.status).toBe('roundEnd');
        expect(room.round.winner).toBeNull();
        expect(room.players.map(p => p.wins)).toEqual([0, 0, 0]);
    });

    it('降参した人は、その問題ではもう勝てない', async () => {
        await ctx.service.handle('c0', { action: 'surrender', round: 1 });
        await ctx.service.handle('c0', { action: 'solved', round: 1 });
        expect(ctx.last('c1', 'room').room.status).toBe('playing');
    });

    it('必要な勝ち数に届いたら試合終了。部屋に戻ると勝ち数が0に戻る', async () => {
        await ctx.service.handle('c2', { action: 'solved', round: 1 });
        await ctx.service.handle('c0', { action: 'nextRound', round: 1 });
        await ctx.service.handle('c2', { action: 'solved', round: 2 });
        let room = ctx.last('c0', 'room').room;
        expect(room.status).toBe('matchEnd');
        expect(room.players[2].wins).toBe(2);

        await ctx.service.handle('c1', { action: 'backToLobby' });
        room = ctx.last('c0', 'room').room;
        expect(room.status).toBe('lobby');
        expect(room.round).toBeNull();
        expect(room.players.map(p => p.wins)).toEqual([0, 0, 0]);
    });

    it('切断しても同じトークンで同じ席に戻れる', async () => {
        const token = ctx.last('c1', 'joined').token;
        const code = ctx.last('c1', 'joined').roomCode;
        await ctx.service.disconnect('c1');
        expect(ctx.last('c0', 'room').room.players[1].connected).toBe(false);

        await ctx.service.handle('c1b', { action: 'join', roomCode: code, token });
        const rejoined = ctx.last('c1b', 'room');
        expect(rejoined.seat).toBe(1);
        expect(rejoined.room.round.number).toBe(1);
        expect(ctx.last('c0', 'room').room.players[1].connected).toBe(true);
    });

    it('残りの人が全員切断したら、勝者なしで問題を終える', async () => {
        await ctx.service.handle('c0', { action: 'surrender', round: 1 });
        await ctx.service.disconnect('c1');
        await ctx.service.disconnect('c2');
        expect(ctx.last('c0', 'room').room.status).toBe('roundEnd');
    });

    it('対戦中に退出した人は「退出」として残り、部屋に戻ると席から外れる', async () => {
        await ctx.service.handle('c0', { action: 'leave' });
        expect(ctx.last('c0', 'left')).toBeTruthy();
        let room = ctx.last('c1', 'room').room;
        expect(room.players[0].left).toBe(true);

        await ctx.service.handle('c1', { action: 'solved', round: 1 });
        await ctx.service.handle('c1', { action: 'nextRound', round: 1 });
        await ctx.service.handle('c1', { action: 'solved', round: 2 });
        await ctx.service.handle('c2', { action: 'backToLobby' });
        room = ctx.last('c1', 'room').room;
        expect(room.players.map(p => p.name)).toEqual(['B', 'C']);
        // 先頭になった人が部屋を作った人の役を引き継ぎ、席番号も詰まる
        expect(ctx.last('c1', 'room').seat).toBe(0);
        await ctx.service.handle('c1', { action: 'start' });
        expect(ctx.last('c2', 'room').room.status).toBe('playing');
    });
});

describe('ロビーでの退出', () => {
    it('部屋を作った人が抜けると、次の人が引き継ぐ', async () => {
        const ctx = setup();
        await createRoomWith(ctx, ['A', 'B']);
        await ctx.service.handle('c0', { action: 'leave' });
        const message = ctx.last('c1', 'room');
        expect(message.room.players.map(p => p.name)).toEqual(['B']);
        expect(message.seat).toBe(0);
        await ctx.service.handle('c1', { action: 'setWinsNeeded', winsNeeded: 1 });
        expect(ctx.last('c1', 'room').room.winsNeeded).toBe(1);
    });
});
