// sfx.js — SFX 시스템
// • 기본 SFX : HTML5 Audio pool (round-robin)
// • 카드별 variant : Web Audio API
//     3-파라미터 독립 변형 → pitch ±28% + highshelf EQ ±6dB + gain ±20%
//     카드 ID 해시 기반이므로 매 게임 동일하게 재현

import { audioPath } from './audioFormat.js';

// ─────────────────────────────────────────────────────────────
// HTML5 Audio pool  (기본 SFX 전용 — shuffle, endTurn, error …)
// ─────────────────────────────────────────────────────────────
const POOL = 3;
const _pools = {};

function _getPool(name) {
    if (!_pools[name]) {
        _pools[name] = {
            list: Array.from({ length: POOL }, () => {
                const a = new Audio(audioPath(name));
                a.volume = 0.5;
                return a;
            }),
            idx: 0,
        };
    }
    return _pools[name];
}

function play(name) {
    const p = _getPool(name);
    const a = p.list[p.idx];
    p.idx = (p.idx + 1) % POOL;
    a.currentTime  = 0;
    a.playbackRate = 1.0;
    a.play().catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// Web Audio API  (카드별 variant 전용)
// ─────────────────────────────────────────────────────────────
let _actx = null;
const _bufCache = new Map();

function _getCtx() {
    if (!_actx) {
        const AC = window.AudioContext || window['webkitAudioContext'];
        _actx = new AC();
    }
    if (_actx.state === 'suspended') _actx.resume().catch(() => {});
    return _actx;
}

async function _getBuffer(name) {
    if (!_bufCache.has(name)) {
        const resp = await fetch(audioPath(name));
        const arr  = await resp.arrayBuffer();
        const buf  = await _getCtx().decodeAudioData(arr);
        _bufCache.set(name, buf);
    }
    return _bufCache.get(name);
}

// FNV-1a — seed가 다르면 같은 문자열에서도 독립적인 값 생성
function _hash(seed, str) {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h  = Math.imul(h, 0x01000193);
    }
    return ((h >>> 0) & 0xffff) / 0xffff; // 0.0 ~ 1.0
}

/**
 * Web Audio API 3-파라미터 재생
 * @param {string} name     - base SFX 파일명
 * @param {number} rate     - playbackRate (pitch 배수)
 * @param {number} shelfHz  - highshelf pivot (Hz)
 * @param {number} shelfDb  - highshelf gain (dB, +밝게/-어둡게)
 * @param {number} gainMult - 마스터 볼륨 배수
 */
function _playWebaudio(name, rate, shelfHz, shelfDb, gainMult) {
    const ctx = _getCtx();
    _getBuffer(name).then(buf => {
        const src              = ctx.createBufferSource();
        src.buffer             = buf;
        src.playbackRate.value = rate;

        const filt           = ctx.createBiquadFilter();
        filt.type            = 'highshelf';
        filt.frequency.value = shelfHz;
        filt.gain.value      = shelfDb;

        const gain      = ctx.createGain();
        gain.gain.value = gainMult * 0.50; // master 0.50

        src.connect(filt);
        filt.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);
    }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// 카드 타입 → base SFX 매핑
// ─────────────────────────────────────────────────────────────
const _TYPE_BASE = {
    '행동':      'playCard',    // Action
    '행동-공격': 'gainAction',  // Action-Attack  → 칼날 소리
    '행동-반응': 'playCard',    // Action-Reaction
    '재물':      'gainCoin',    // Treasure
    '승점':      'buyCard',     // Victory
    '저주':      'error',       // Curse
    // 정규화 type 폴백
    Action:   'playCard',
    Treasure: 'gainCoin',
    Victory:  'buyCard',
    Curse:    'error',
};

function _baseSfx(def) {
    return _TYPE_BASE[def.rawType] ?? _TYPE_BASE[def.type] ?? 'playCard';
}

// ─────────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────────
export const SFX = {
    // ── 기본 (HTML5 Audio, rate=1.0) ─────────────────────────
    playCard:   () => play('playCard'),
    buyCard:    () => play('buyCard'),
    error:      () => play('error'),
    gainCoin:   () => play('gainCoin'),
    shuffle:    () => play('shuffle'),
    gainAction: () => play('gainAction'),
    drawCard:   () => play('drawCard'),
    endTurn:    () => play('endTurn'),

    // ── 카드 사용  (Web Audio API, 3-파라미터 카드별 변형) ──────
    //  pitch    : 0.72 ~ 1.28  (±28%, 약 ±5.5 반음)
    //  tone     : 800 ~ 7200Hz highshelf ±6dB
    //  volume   : 0.80 ~ 1.20  (±20%)
    playCardVariant(def) {
        const id       = def.id;
        const rate     = 0.72 + _hash(0x811c9dc5, id) * 0.56;  // 0.72~1.28
        const shelfHz  = 800  + _hash(0x6b973f4d, id) * 6400;  // 800~7200Hz
        const shelfDb  = -6   + _hash(0xdeadbeef, id) * 12;    // -6~+6 dB
        const gainMult = 0.80 + _hash(0x517cc1b7, id) * 0.40;  // 0.80~1.20
        _playWebaudio(_baseSfx(def), rate, shelfHz, shelfDb, gainMult);
    },

    // ── 카드 구매  (buyCard 기반, 카드별 변형) ──────────────────
    buyCardVariant(def) {
        const key      = 'buy_' + def.id;
        const rate     = 0.78 + _hash(0x811c9dc5, key) * 0.44;  // 0.78~1.22
        const shelfHz  = 1000 + _hash(0x6b973f4d, key) * 5000;  // 1000~6000Hz
        const shelfDb  = -4   + _hash(0xdeadbeef, key) * 10;    // -4~+6 dB
        const gainMult = 0.80 + _hash(0x517cc1b7, key) * 0.40;  // 0.80~1.20
        _playWebaudio('buyCard', rate, shelfHz, shelfDb, gainMult);
    },

    // ── 사전 로드  (게임 시작 시 호출 → 첫 재생 지연 없음) ───────
    preload(names = ['playCard', 'gainAction', 'gainCoin', 'buyCard', 'error']) {
        names.forEach(n => _getBuffer(n).catch(() => {}));
    },
};
