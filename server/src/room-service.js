/**
 * オンライン対戦の部屋の処理
 * 保存先（store）と送信（send）は外から渡すので、AWS でも手元のテスト用サーバーでも同じ処理を使える
 *
 * 2〜4人が同じ問題を同時に解き、一番早く解いた人がその問題の勝ち。先に決めた勝ち数に届いた人が優勝
 * 問題は問題番号（シード）から各端末で作るので、サーバーは問題番号・開始時刻・結果だけを扱う
 */

export const MAX_PLAYERS = 4;
export const MIN_WINS = 1;
export const MAX_WINS = 5;
export const DEFAULT_WINS = 3;
export const COUNTDOWN_MS = 3000;           // 問題を配ってから解き始めるまで（全員が同時に始められるように）
const MAX_SEED = 1000000;                   // 問題番号の範囲（画面の「次の問題」と同じ6桁）
const ROOM_TTL_SECONDS = 24 * 60 * 60;      // 部屋は最後の操作から1日で消える
const CODE_ALPHABET = '0123456789';         // 部屋番号は数字だけ（スマホの数字キーボードで入れやすい）
const CODE_LENGTH = 5;
const MAX_NAME_LENGTH = 12;
const MAX_RETRIES = 3;                      // 同時に操作されて保存がぶつかったときのやり直し回数

// 保存がぶつかったとき（他の操作が先に保存した）に store が投げるエラー
export class ConflictError extends Error {}

// 利用者に伝えるエラー（メッセージをそのまま画面に出す）
class UserError extends Error {}

export class RoomService {
    // store: getRoom(code) / putRoom(room, previousVersion) / getConnection(id) / putConnection(connection) / deleteConnection(id)
    // send: (connectionId, message) => Promise（接続が切れていれば失敗してよい）
    constructor({ store, send, createToken = () => crypto.randomUUID(), now = () => Date.now(), random = Math.random }) {
        this.store = store;
        this.sendRaw = send;
        this.createToken = createToken;
        this.now = now;
        this.random = random;
    }

    // ===== 入口 =====

    // 端末からのメッセージを処理する。保存がぶつかったら読み直してやり直す
    async handle(connectionId, message) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const outbox = await this.route(connectionId, message ?? {});
                await this.flush(outbox);
                return;
            } catch (error) {
                if (error instanceof ConflictError) continue;
                if (error instanceof UserError) {
                    await this.send(connectionId, { type: 'error', message: error.message });
                    return;
                }
                throw error;
            }
        }
        await this.send(connectionId, { type: 'error', message: '混み合っています。もう一度操作してください' });
    }

    // 接続が切れたら、参加者を「切断中」にする（席はそのまま残し、再接続できるようにする）
    // 対戦中なら、まだ解いている人がいなくなった時点でその問題を終える
    async disconnect(connectionId) {
        const connection = await this.store.getConnection(connectionId);
        await this.store.deleteConnection(connectionId);
        if (!connection) return;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const room = await this.store.getRoom(connection.roomCode);
            const player = room?.players[connection.seat];
            if (!player || player.connectionId !== connectionId) return;
            player.connectionId = null;
            this.endRoundIfNobodyLeft(room);
            try {
                await this.saveRoom(room);
                await this.flush(this.roomMessages(room));
                return;
            } catch (error) {
                if (!(error instanceof ConflictError)) throw error;
            }
        }
    }

    async route(connectionId, message) {
        switch (message.action) {
            case 'create': return this.createRoom(connectionId, message);
            case 'join': return this.joinRoom(connectionId, message);
        }

        // ここから先は部屋に入っている端末だけ
        const { room, seat } = await this.loadMember(connectionId);
        switch (message.action) {
            case 'setWinsNeeded': return this.setWinsNeeded(room, seat, message.winsNeeded);
            case 'start': return this.startMatch(room, seat);
            case 'solved': return this.finishPuzzle(room, seat, message.round, 'solved');
            case 'surrender': return this.finishPuzzle(room, seat, message.round, 'surrendered');
            case 'nextRound': return this.nextRound(room, message.round);
            case 'backToLobby': return this.backToLobby(room);
            case 'leave': return this.leaveRoom(room, seat, connectionId);
            default: throw new UserError('不明な操作です');
        }
    }

    // ===== 部屋に入る =====

    async createRoom(connectionId, { name }) {
        const room = {
            code: null,
            version: 0,
            status: 'lobby', // lobby → playing ⇄ roundEnd → matchEnd → lobby
            winsNeeded: DEFAULT_WINS,
            players: [this.newPlayer(name, connectionId)],
            round: null
        };

        // 部屋番号が既存の部屋とぶつかったら作り直す
        for (let attempt = 0; ; attempt++) {
            room.code = this.createRoomCode();
            try {
                await this.saveRoom(room);
                break;
            } catch (error) {
                if (!(error instanceof ConflictError) || attempt >= 5) throw error;
            }
        }
        await this.putConnection(connectionId, room.code, 0);
        return [this.joinedMessage(room, 0), ...this.roomMessages(room)];
    }

    // 部屋に参加する。token が参加者のものなら、その席に再接続する（対戦中でも戻れる）
    async joinRoom(connectionId, { roomCode, name, token }) {
        const room = await this.store.getRoom(String(roomCode ?? '').trim());
        if (!room) throw new UserError('部屋が見つかりません');

        let seat = token ? room.players.findIndex(player => player.token === token && !player.left) : -1;
        if (seat >= 0) {
            room.players[seat].connectionId = connectionId;
        } else {
            if (room.status !== 'lobby') throw new UserError('この部屋は対戦が始まっています');
            if (room.players.length >= MAX_PLAYERS) throw new UserError('この部屋は満員です');
            room.players.push(this.newPlayer(name, connectionId));
            seat = room.players.length - 1;
        }

        await this.saveRoom(room);
        await this.putConnection(connectionId, room.code, seat);
        return [this.joinedMessage(room, seat), ...this.roomMessages(room)];
    }

    // ===== ロビー（必要な勝ち数と開始は、部屋を作った人＝席0の人だけが操作できる） =====

    setWinsNeeded(room, seat, winsNeeded) {
        this.assertHostInLobby(room, seat);
        const wins = Number(winsNeeded);
        if (!Number.isInteger(wins) || wins < MIN_WINS || wins > MAX_WINS) {
            throw new UserError(`勝ち数は${MIN_WINS}〜${MAX_WINS}で選んでください`);
        }
        room.winsNeeded = wins;
        return this.saveAndAnnounce(room);
    }

    startMatch(room, seat) {
        this.assertHostInLobby(room, seat);
        if (room.players.length < 2) throw new UserError('2人以上で始めてください');
        room.players.forEach(player => { player.wins = 0; });
        this.startRound(room, 1);
        return this.saveAndAnnounce(room);
    }

    // ===== 対戦中 =====

    // 解けた・降参した。一番早く解いた人がその問題の勝ち
    // round は端末が解いていた問題の番号（前の問題の遅れた通知や、二重の通知を無視するため）
    finishPuzzle(room, seat, roundNumber, result) {
        if (room.status !== 'playing' || room.round?.number !== roundNumber) return [];
        if (room.round.results[seat]) return [];

        const time = Math.max(0, this.now() - room.round.startAt);
        room.round.results[seat] = { result, time };

        if (result === 'solved') {
            const winner = room.players[seat];
            winner.wins = (winner.wins ?? 0) + 1;
            room.round.winner = seat;
            room.round.winnerTime = time;
            room.status = winner.wins >= room.winsNeeded ? 'matchEnd' : 'roundEnd';
        } else {
            this.endRoundIfNobodyLeft(room);
        }
        return this.saveAndAnnounce(room);
    }

    // 次の問題へ（誰が押してもよい。同時に押されても、同じ問題の番号のときだけ進める）
    nextRound(room, roundNumber) {
        if (room.status !== 'roundEnd' || room.round?.number !== roundNumber) return [];
        this.startRound(room, roundNumber + 1);
        return this.saveAndAnnounce(room);
    }

    // 試合が終わったら部屋に戻り、同じメンバーで続けられるようにする（誰が押してもよい）
    // 退出した人はここで席から外し、残った人の先頭が部屋を作った人の役を引き継ぐ
    async backToLobby(room) {
        if (room.status !== 'matchEnd') return [];
        room.status = 'lobby';
        room.round = null;
        room.players = room.players.filter(player => !player.left);
        room.players.forEach(player => { player.wins = 0; });
        return this.saveAndAnnounce(room, { reseat: true });
    }

    // 部屋を出る。ロビーでは席から外し、対戦中は「退出」として残す（勝ち数の表示を崩さないため）
    async leaveRoom(room, seat, connectionId) {
        const player = room.players[seat];
        if (room.status === 'lobby') {
            room.players.splice(seat, 1);
        } else {
            player.left = true;
            player.connectionId = null;
            this.endRoundIfNobodyLeft(room);
        }
        await this.store.deleteConnection(connectionId);
        const announce = room.players.length > 0
            ? await this.saveAndAnnounce(room, { reseat: room.status === 'lobby' })
            : (await this.saveRoom(room), []);
        return [{ connectionId, message: { type: 'left' } }, ...announce];
    }

    startRound(room, number) {
        room.status = 'playing';
        room.round = {
            number,
            seed: Math.floor(this.random() * MAX_SEED),
            startAt: this.now() + COUNTDOWN_MS,
            results: room.players.map(() => null),
            winner: null,
            winnerTime: null
        };
    }

    // まだ解いている人（接続中で、解けても降参してもいない人）がいなくなったら、勝者なしで問題を終える
    endRoundIfNobodyLeft(room) {
        if (room.status !== 'playing') return;
        const stillPlaying = room.players.some((player, seat) =>
            !player.left && player.connectionId && !room.round.results[seat]);
        if (!stillPlaying) {
            room.status = 'roundEnd';
        }
    }

    // ===== 保存と送信 =====

    async saveAndAnnounce(room, { reseat = false } = {}) {
        await this.saveRoom(room);
        if (reseat) {
            // 席が詰まったので、接続の席番号を書き直す
            await Promise.all(room.players.map((player, seat) => player.connectionId
                ? this.putConnection(player.connectionId, room.code, seat)
                : null));
        }
        return this.roomMessages(room);
    }

    // 部屋を保存する（読み込んだときと版が違えば ConflictError）
    async saveRoom(room) {
        const previousVersion = room.version;
        room.version = previousVersion + 1;
        room.expiresAt = this.expiresAt();
        try {
            await this.store.putRoom(room, previousVersion);
        } catch (error) {
            room.version = previousVersion;
            throw error;
        }
    }

    async flush(outbox) {
        // 同じ端末へのメッセージは順番を守り、端末どうしは並べて送る
        const byConnection = new Map();
        outbox.forEach(({ connectionId, message }) => {
            if (!byConnection.has(connectionId)) byConnection.set(connectionId, []);
            byConnection.get(connectionId).push(message);
        });
        await Promise.all([...byConnection].map(async ([connectionId, messages]) => {
            for (const message of messages) {
                await this.send(connectionId, message);
            }
        }));
    }

    async send(connectionId, message) {
        try {
            await this.sendRaw(connectionId, message);
        } catch {
            // 切れた接続には送れなくてよい（切断の通知で片付ける）
        }
    }

    // ===== メッセージ =====

    joinedMessage(room, seat) {
        const player = room.players[seat];
        return { connectionId: player.connectionId, message: { type: 'joined', roomCode: room.code, seat, token: player.token } };
    }

    // 部屋の状態を接続している全員に送る
    // 受け取る人の席番号と、サーバーの今の時刻（開始時刻を端末の時計に合わせるため）を添える
    roomMessages(room) {
        const serverNow = this.now();
        const state = {
            code: room.code,
            status: room.status,
            winsNeeded: room.winsNeeded,
            players: room.players.map((player, seat) => ({
                seat,
                name: player.name,
                wins: player.wins ?? 0,
                connected: Boolean(player.connectionId),
                left: Boolean(player.left)
            })),
            round: room.round
        };
        return room.players
            .map((player, seat) => ({ player, seat }))
            .filter(({ player }) => player.connectionId)
            .map(({ player, seat }) => ({
                connectionId: player.connectionId,
                message: { type: 'room', room: state, seat, serverNow }
            }));
    }

    // ===== 補助 =====

    async loadMember(connectionId) {
        const connection = await this.store.getConnection(connectionId);
        if (!connection) throw new UserError('部屋に入っていません');
        const room = await this.store.getRoom(connection.roomCode);
        if (!room || room.players[connection.seat]?.connectionId !== connectionId) {
            throw new UserError('部屋に入っていません');
        }
        return { room, seat: connection.seat };
    }

    assertHostInLobby(room, seat) {
        if (seat !== 0) throw new UserError('部屋を作った人だけが操作できます');
        if (room.status !== 'lobby') throw new UserError('対戦中は変更できません');
    }

    putConnection(connectionId, roomCode, seat) {
        return this.store.putConnection({ connectionId, roomCode, seat, expiresAt: this.expiresAt() });
    }

    newPlayer(name, connectionId) {
        const trimmed = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
        return { name: trimmed || 'プレイヤー', token: this.createToken(), connectionId, wins: 0 };
    }

    createRoomCode() {
        return Array.from({ length: CODE_LENGTH },
            () => CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)]).join('');
    }

    expiresAt() {
        return Math.floor(this.now() / 1000) + ROOM_TTL_SECONDS;
    }
}
