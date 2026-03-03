// sfx.js — 동시 재생 대응: 사운드당 3개 인스턴스 pool (round-robin)
import { audioPath } from './audioFormat.js';

const POOL = 3;
const pools = {};

function getPool(name) {
    if (!pools[name]) {
        pools[name] = {
            list: Array.from({ length: POOL }, () => {
                const a = new Audio(audioPath(name));
                a.volume = 0.5;
                return a;
            }),
            idx: 0,
        };
    }
    return pools[name];
}

function play(name) {
    const p = getPool(name);
    const a = p.list[p.idx];
    p.idx = (p.idx + 1) % POOL;
    a.currentTime = 0;
    a.play().catch(() => {});
}

export const SFX = {
    playCard:   () => play('playCard'),
    buyCard:    () => play('buyCard'),
    error:      () => play('error'),
    gainCoin:   () => play('gainCoin'),
    shuffle:    () => play('shuffle'),
    gainBuy:    () => play('gainBuy'),
    gainAction: () => play('gainAction'),
    gainVP:     () => play('gainVP'),
};
