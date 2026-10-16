/**
 * 効果音と BGM モジュール（音声ファイルは使わず、Web Audio API でその場で合成する）
 *
 * - 音色はチップチューン（ファミコンのような矩形波・三角波・ノイズ）
 * - ブラウザの自動再生の制限があるので、最初のタップ・クリック・キー入力までは鳴らさない
 * - 効果音と BGM の ON/OFF は localStorage に保存する（初めは両方 ON）
 * - 別のタブを見ている間は、音を止める
 *
 * 画面からは playSound(名前) と、設定の関数（getSoundSettings・toggleSound・toggleAllSound・onSoundSettingsChange）だけを使う
 */

const SOUND_SETTINGS_KEY = 'mineBlocks.sound';
const SOUND_VOLUME = { master: 0.8, effects: 0.5, bgm: 0.14 };
const BGM_LOOKAHEAD_SEC = 0.3; // BGM は、この先の分まで前もって予約する
const BGM_SCHEDULE_MS = 100;   // 予約を確かめる間隔
const BGM_STEP_SEC = 60 / 144 / 4; // 1拍を4つに分けた長さ（テンポ 144）

const soundState = {
    context: null,
    master: null,
    effectsGain: null,
    bgmGain: null,
    noise: null,
    settings: loadSoundSettings(),
    bgmTimer: null,
    bgmStep: 0,       // 次に予約する BGM の位置（16分音符の数）
    bgmNextTime: 0,   // 次に予約する BGM の時刻
    listeners: new Set()
};

// ===== 設定 =====

function loadSoundSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY) || 'null');
        return { effects: saved?.effects ?? true, bgm: saved?.bgm ?? true };
    } catch {
        return { effects: true, bgm: true };
    }
}

function saveSoundSettings() {
    try {
        localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(soundState.settings));
    } catch {
        // 保存できなくても、このページを開いている間は切り替えが効く
    }
}

function getSoundSettings() {
    return { ...soundState.settings };
}

// 設定が変わったら知らせる（ボタンの表示を合わせるため）
function onSoundSettingsChange(listener) {
    soundState.listeners.add(listener);
}

// 効果音（'effects'）か BGM（'bgm'）の ON/OFF を切り替える
function toggleSound(kind) {
    setSoundSettings({ ...soundState.settings, [kind]: !soundState.settings[kind] });
}

// ヘッダーのボタン：どちらかが鳴っていれば両方消し、両方消えていれば両方つける
function toggleAllSound() {
    const on = !(soundState.settings.effects || soundState.settings.bgm);
    setSoundSettings({ effects: on, bgm: on });
}

function setSoundSettings(settings) {
    soundState.settings = settings;
    saveSoundSettings();
    unlockSound(); // 切り替えのボタンを押したこと自体が、最初の操作になることもある
    updateBgm();
    soundState.listeners.forEach(listener => listener(getSoundSettings()));
}

// ===== 準備 =====

// 最初のタップ・クリック・キー入力で音を使えるようにする（自動再生の制限のため、操作の中で作る）
function setupSound() {
    const unlock = () => {
        unlockSound();
        if (soundState.context?.state === 'running') {
            ['pointerdown', 'touchend', 'click', 'keydown'].forEach(type => document.removeEventListener(type, unlock, true));
        }
    };
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(type => document.addEventListener(type, unlock, true));

    // 別のタブを見ている間は、音を止める
    document.addEventListener('visibilitychange', () => {
        if (!soundState.context) return;
        if (document.hidden) {
            soundState.context.suspend();
        } else {
            soundState.context.resume();
        }
        updateBgm();
    });
}

function unlockSound() {
    if (!soundState.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        soundState.context = context;
        soundState.master = context.createGain();
        soundState.master.gain.value = SOUND_VOLUME.master;
        soundState.master.connect(context.destination);
        soundState.effectsGain = context.createGain();
        soundState.effectsGain.gain.value = SOUND_VOLUME.effects;
        soundState.effectsGain.connect(soundState.master);
        soundState.bgmGain = context.createGain();
        soundState.bgmGain.gain.value = SOUND_VOLUME.bgm;
        soundState.bgmGain.connect(soundState.master);
        soundState.noise = createNoiseBuffer(context);
    }
    if (soundState.context.state === 'suspended' && !document.hidden) soundState.context.resume();
    updateBgm();
}

function createNoiseBuffer(context) {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}

// ===== 音の部品 =====

// 音名（'C5' など）を周波数にする
function noteToFrequency(note) {
    const match = /^([A-G])(#?)(\d)$/.exec(note);
    const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] + (match[2] ? 1 : 0);
    const midi = (Number(match[3]) + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// 1つの音を鳴らす（type：'square'・'triangle' など、from・to：周波数、to を指定すると音の高さを滑らせる）
function playTone(destination, { type = 'square', from, to = from, start, duration, volume = 0.3 }) {
    const context = soundState.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
}

// ノイズ（打楽器）を鳴らす
function playNoise(destination, { start, duration, volume = 0.2, filter = 'highpass', frequency = 6000 }) {
    const context = soundState.context;
    const source = context.createBufferSource();
    source.buffer = soundState.noise;
    const biquad = context.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(biquad).connect(gain).connect(destination);
    source.start(start);
    source.stop(start + duration + 0.02);
}

// 音名の並びを、決まった間隔で順に鳴らす（ファンファーレなど）
function playNotes(notes, { start, interval, duration = interval, type = 'square', volume = 0.3, lastDuration = duration }) {
    notes.forEach((note, i) => {
        playTone(soundState.effectsGain, {
            type,
            from: noteToFrequency(note),
            start: start + i * interval,
            duration: i === notes.length - 1 ? lastDuration : duration,
            volume
        });
    });
}

// ===== 効果音 =====

const SOUND_EFFECTS = {
    // ピースを選んだ
    select: (t) => playTone(soundState.effectsGain, { from: 880, start: t, duration: 0.05, volume: 0.2 }),
    // ピースを置いた：上がる音と、軽い着地の音
    place: (t) => {
        playTone(soundState.effectsGain, { from: 523, to: 784, start: t, duration: 0.07, volume: 0.25 });
        playTone(soundState.effectsGain, { type: 'triangle', from: 196, to: 98, start: t, duration: 0.09, volume: 0.4 });
    },
    // 置けなかった：低い2つの音
    invalid: (t) => {
        playTone(soundState.effectsGain, { from: 196, start: t, duration: 0.07, volume: 0.18 });
        playTone(soundState.effectsGain, { from: 147, start: t + 0.08, duration: 0.1, volume: 0.18 });
    },
    // ピースを外した：下がる音
    remove: (t) => playTone(soundState.effectsGain, { from: 784, to: 440, start: t, duration: 0.07, volume: 0.2 }),
    // クリア・問題の勝ち：上がっていくファンファーレ
    clear: (t) => {
        playNotes(['C5', 'E5', 'G5', 'C6'], { start: t, interval: 0.08, lastDuration: 0.35, volume: 0.25 });
        playNotes(['C4', 'G4'], { start: t, interval: 0.16, type: 'triangle', lastDuration: 0.4, volume: 0.35 });
    },
    // チャレンジで1問解いた（+20秒）：短く上がる音
    bonus: (t) => playNotes(['G5', 'C6', 'E6'], { start: t, interval: 0.06, lastDuration: 0.18, volume: 0.22 }),
    // 降参・問題の負け：下がる3つの音
    surrender: (t) => playNotes(['G4', 'E4', 'C4'], { start: t, interval: 0.12, lastDuration: 0.25, type: 'triangle', volume: 0.4 }),
    lose: (t) => playNotes(['E5', 'C5', 'A4'], { start: t, interval: 0.1, lastDuration: 0.25, volume: 0.2 }),
    // チャレンジの残り10秒の時計の音
    tick: (t) => playTone(soundState.effectsGain, { from: 1200, start: t, duration: 0.025, volume: 0.12 }),
    // チャレンジ終了
    timeUp: (t) => playNotes(['C5', 'G4', 'E4', 'C4'], { start: t, interval: 0.11, lastDuration: 0.35, volume: 0.22 }),
    // 対戦の開始前のカウントダウン（3・2・1）と、開始
    count: (t) => playTone(soundState.effectsGain, { from: 660, start: t, duration: 0.09, volume: 0.22 }),
    go: (t) => playTone(soundState.effectsGain, { from: 1320, start: t, duration: 0.22, volume: 0.22 }),
    // 対戦の優勝：長めのファンファーレ
    victory: (t) => {
        playNotes(['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], { start: t, interval: 0.09, lastDuration: 0.5, volume: 0.25 });
        playNotes(['C3', 'G3', 'C4'], { start: t, interval: 0.21, type: 'triangle', lastDuration: 0.6, volume: 0.35 });
    }
};

// 効果音を鳴らす（効果音が OFF のとき・まだ最初の操作がないときは鳴らさない）
function playSound(name) {
    const context = soundState.context;
    if (!soundState.settings.effects || !context || context.state !== 'running') return;
    SOUND_EFFECTS[name]?.(context.currentTime + 0.01);
}

// ===== BGM =====

// 8小節のループ。和音は C・Am・F・G を2回（2回目の終わりは G のまま最初に戻る）
// メロディは [音名, 長さ（16分音符の数）]。null は休み
const BGM_MELODY = [
    [['E5', 2], ['G5', 2], ['C6', 3], ['B5', 1], ['C6', 2], ['G5', 2], ['E5', 4]],
    [['A5', 2], ['C6', 2], ['E6', 3], ['D6', 1], ['C6', 2], ['A5', 2], ['E5', 4]],
    [['F5', 2], ['A5', 2], ['C6', 2], ['A5', 2], ['D6', 4], ['C6', 2], ['A5', 2]],
    [['B5', 2], ['D6', 2], ['G5', 2], ['B5', 2], ['D6', 4], [null, 4]],
    [['E6', 2], ['D6', 2], ['C6', 2], ['G5', 2], ['A5', 2], ['G5', 2], ['E5', 4]],
    [['C6', 2], ['B5', 2], ['A5', 2], ['E5', 2], ['A5', 2], ['B5', 2], ['C6', 4]],
    [['A5', 2], ['C6', 2], ['F6', 2], ['E6', 2], ['D6', 2], ['C6', 2], ['A5', 2], ['C6', 2]],
    [['D6', 2], ['B5', 2], ['G5', 2], ['B5', 2], ['D6', 4], ['G6', 4]]
];
const BGM_BASS_ROOTS = ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'F2', 'G2'];
const BGM_STEPS_PER_BAR = 16;
const BGM_LOOP_STEPS = BGM_MELODY.length * BGM_STEPS_PER_BAR;

// メロディを、ループの中の位置（16分音符の数）→ [音名, 長さ] の表にする
const BGM_MELODY_BY_STEP = (() => {
    const notes = new Map();
    BGM_MELODY.forEach((bar, barIndex) => {
        let step = barIndex * BGM_STEPS_PER_BAR;
        bar.forEach(([note, length]) => {
            if (note) notes.set(step, [note, length]);
            step += length;
        });
    });
    return notes;
})();

// BGM を流すか止めるかを、設定とタブの状態に合わせる
function updateBgm() {
    const context = soundState.context;
    const shouldPlay = soundState.settings.bgm && context && !document.hidden;
    if (shouldPlay && !soundState.bgmTimer) {
        soundState.bgmStep = 0;
        soundState.bgmNextTime = context.currentTime + 0.1;
        soundState.bgmTimer = setInterval(scheduleBgm, BGM_SCHEDULE_MS);
        scheduleBgm();
    } else if (!shouldPlay && soundState.bgmTimer) {
        clearInterval(soundState.bgmTimer);
        soundState.bgmTimer = null;
    }
}

// この先 BGM_LOOKAHEAD_SEC 秒の分を予約する
function scheduleBgm() {
    const context = soundState.context;
    if (context.state !== 'running') return;
    // 裏から戻ったときなどに遅れていたら、今の時刻から数え直す
    if (soundState.bgmNextTime < context.currentTime) soundState.bgmNextTime = context.currentTime + 0.05;
    while (soundState.bgmNextTime < context.currentTime + BGM_LOOKAHEAD_SEC) {
        scheduleBgmStep(soundState.bgmStep, soundState.bgmNextTime);
        soundState.bgmStep = (soundState.bgmStep + 1) % BGM_LOOP_STEPS;
        soundState.bgmNextTime += BGM_STEP_SEC;
    }
}

function scheduleBgmStep(step, time) {
    const out = soundState.bgmGain;
    const bar = Math.floor(step / BGM_STEPS_PER_BAR);
    const inBar = step % BGM_STEPS_PER_BAR;

    // メロディ（矩形波）
    const melody = BGM_MELODY_BY_STEP.get(step);
    if (melody) {
        playTone(out, { from: noteToFrequency(melody[0]), start: time, duration: melody[1] * BGM_STEP_SEC * 0.9, volume: 0.22 });
    }

    // ベース（三角波）：8分音符で、根音と1オクターブ上を交互に
    if (inBar % 2 === 0) {
        const root = noteToFrequency(BGM_BASS_ROOTS[bar]);
        playTone(out, { type: 'triangle', from: inBar % 4 === 0 ? root : root * 2, start: time, duration: BGM_STEP_SEC * 1.8, volume: 0.5 });
    }

    // ドラム（ノイズ）：1・3拍目にキック、2・4拍目にスネア、8分音符でハイハット
    if (inBar % 8 === 0) {
        playTone(out, { type: 'sine', from: 150, to: 45, start: time, duration: 0.12, volume: 0.7 });
    }
    if (inBar % 8 === 4) {
        playNoise(out, { start: time, duration: 0.12, volume: 0.35, filter: 'bandpass', frequency: 1800 });
    }
    if (inBar % 2 === 0) {
        playNoise(out, { start: time, duration: 0.03, volume: 0.15 });
    }
}
