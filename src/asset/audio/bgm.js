// bgm.js
// Generative medieval board-game BGM manager.
// 6 instruments x 3 variations = 18 stems with arrangement sections and musical motion.
import { audioPath } from './audioFormat.js';

const categories = {
    drone: {
        maxVol: 0.26,
        baseSilenceChance: 0.0,
        modDepth: 0.06,
        modHz: 0.05,
        stems: [
            { name: 'bgm_drone1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_drone2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_drone3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    },
    lute: {
        maxVol: 0.24,
        baseSilenceChance: 0.08,
        modDepth: 0.08,
        modHz: 0.10,
        stems: [
            { name: 'bgm_lute1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_lute2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_lute3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    },
    flute: {
        maxVol: 0.17,
        baseSilenceChance: 0.30,
        modDepth: 0.10,
        modHz: 0.13,
        stems: [
            { name: 'bgm_flute1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_flute2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_flute3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    },
    viol: {
        maxVol: 0.19,
        baseSilenceChance: 0.16,
        modDepth: 0.09,
        modHz: 0.09,
        stems: [
            { name: 'bgm_viol1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_viol2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_viol3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    },
    choir: {
        maxVol: 0.12,
        baseSilenceChance: 0.34,
        modDepth: 0.05,
        modHz: 0.04,
        stems: [
            { name: 'bgm_choir1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_choir2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_choir3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    },
    perc: {
        maxVol: 0.23,
        baseSilenceChance: 0.02,
        modDepth: 0.03,
        modHz: 0.18,
        stems: [
            { name: 'bgm_perc1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_perc2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_perc3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    }
};

const sections = [
    {
        name: 'calm',
        durationMs: 22000,
        density: 0.55,
        volMul: { drone: 1.00, lute: 0.70, flute: 0.55, viol: 0.62, choir: 0.45, perc: 0.50 },
        leadPool: ['lute', 'viol']
    },
    {
        name: 'town',
        durationMs: 26000,
        density: 0.72,
        volMul: { drone: 0.95, lute: 1.00, flute: 0.75, viol: 0.85, choir: 0.50, perc: 0.90 },
        leadPool: ['lute', 'flute']
    },
    {
        name: 'tension',
        durationMs: 20000,
        density: 0.78,
        volMul: { drone: 1.10, lute: 0.92, flute: 0.90, viol: 1.00, choir: 0.86, perc: 1.00 },
        leadPool: ['viol', 'choir', 'flute']
    },
    {
        name: 'festival',
        durationMs: 24000,
        density: 0.86,
        volMul: { drone: 1.00, lute: 1.05, flute: 0.85, viol: 0.92, choir: 0.70, perc: 1.08 },
        leadPool: ['lute', 'flute', 'perc']
    }
];

let initialized = false;
let arrangementInterval = null;
let interpolationInterval = null;
let sectionIndex = 0;
let nextSectionAt = 0;
let activeLead = 'lute';
let arrangementStartMs = 0;

const categoryPhase = new Map();
Object.keys(categories).forEach((k, i) => {
    categoryPhase.set(k, i * 0.9);
});

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function nowMs() {
    return performance.now();
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function chooseLead(section) {
    if (section.leadPool.includes(activeLead) && Math.random() < 0.55) return;
    activeLead = pickRandom(section.leadPool);
}

function gotoNextSection() {
    const section = sections[sectionIndex % sections.length];
    chooseLead(section);
    nextSectionAt = nowMs() + section.durationMs;
    sectionIndex = (sectionIndex + 1) % sections.length;
}

function pickStemIndices(stems, count, carryFromCurrent = true) {
    const picked = new Set();

    if (carryFromCurrent) {
        const activeNow = [];
        stems.forEach((s, i) => {
            if (s.currentVol > 0.03 || s.targetVol > 0.03) activeNow.push(i);
        });
        if (activeNow.length > 0 && Math.random() < 0.6) {
            picked.add(pickRandom(activeNow));
        }
    }

    while (picked.size < count) {
        picked.add(Math.floor(Math.random() * stems.length));
    }

    return picked;
}

function setCategoryTargets(key, section) {
    const cat = categories[key];
    const mul = section.volMul[key] ?? 1.0;

    let silenceChance = cat.baseSilenceChance + (0.72 - section.density) * 0.22;
    if (key === 'drone' || key === 'perc') silenceChance = Math.max(0, silenceChance - 0.15);
    if (key === activeLead) silenceChance = Math.max(0, silenceChance - 0.25);

    if (Math.random() < clamp01(silenceChance)) {
        cat.stems.forEach((s) => { s.targetVol = 0; });
        return;
    }

    let activeCount = section.density > 0.8 ? 2 : 1;
    if (key === activeLead && Math.random() < 0.55) activeCount = 2;
    if (key === 'drone' && Math.random() < 0.4) activeCount = 2;

    const picked = pickStemIndices(cat.stems, Math.min(activeCount, cat.stems.length), true);

    cat.stems.forEach((s, idx) => {
        if (!picked.has(idx)) {
            s.targetVol = 0;
            return;
        }

        const base = (cat.maxVol * mul) / activeCount;
        const human = randomBetween(0.82, 1.04);
        const leadBoost = key === activeLead ? 1.08 : 1.0;
        s.targetVol = clamp01(base * human * leadBoost);
    });
}

function keepMusicalFloor() {
    const drone = categories.drone;
    const perc = categories.perc;

    if (drone.stems.every((s) => s.targetVol < 0.015)) {
        drone.stems[0].targetVol = drone.maxVol * 0.65;
    }

    if (perc.stems.every((s) => s.targetVol < 0.015)) {
        perc.stems[0].targetVol = perc.maxVol * 0.58;
    }
}

function refreshArrangement(force = false) {
    if (!force && nowMs() < nextSectionAt) return;

    gotoNextSection();
    const section = sections[(sectionIndex + sections.length - 1) % sections.length];

    Object.keys(categories).forEach((key) => {
        setCategoryTargets(key, section);
    });

    keepMusicalFloor();
}

function animatedVolume(catKey, stemVol) {
    const cat = categories[catKey];
    const elapsed = (nowMs() - arrangementStartMs) / 1000;
    const phase = categoryPhase.get(catKey) || 0;
    const lfo = Math.sin((elapsed * Math.PI * 2 * cat.modHz) + phase);
    const mod = 1 + lfo * cat.modDepth;
    return clamp01(stemVol * mod);
}

export const BGM = {
    start: () => {
        if (initialized) return;
        initialized = true;
        arrangementStartMs = nowMs();
        sectionIndex = 0;
        nextSectionAt = 0;
        activeLead = 'lute';

        Object.values(categories).forEach((cat) => {
            cat.stems.forEach((stem) => {
                if (!stem.audio) {
                    const a = new Audio(audioPath(stem.name));
                    a.loop = true;
                    a.volume = 0;
                    stem.audio = a;
                }

                stem.audio.play().catch((e) => {
                    console.warn(`BGM start blocked for ${stem.name} - waiting for interaction.`, e);
                    initialized = false;
                    return false;
                });
            });
        });

        refreshArrangement(true);

        arrangementInterval = setInterval(() => {
            refreshArrangement(false);
        }, 4000);

        interpolationInterval = setInterval(() => {
            Object.entries(categories).forEach(([catKey, cat]) => {
                cat.stems.forEach((stem) => {
                    if (!stem.audio) return;

                    stem.currentVol += (stem.targetVol - stem.currentVol) * 0.010;
                    const musical = animatedVolume(catKey, stem.currentVol);

                    if (Math.abs(stem.audio.volume - musical) > 0.001) {
                        stem.audio.volume = musical;
                    }
                });
            });
        }, 1000 / 60);
    },

    stop: () => {
        Object.values(categories).forEach((cat) => {
            cat.stems.forEach((stem) => {
                if (stem.audio) stem.audio.pause();
                stem.targetVol = 0;
                stem.currentVol = 0;
            });
        });

        if (arrangementInterval) clearInterval(arrangementInterval);
        if (interpolationInterval) clearInterval(interpolationInterval);
        arrangementInterval = null;
        interpolationInterval = null;
        initialized = false;
    }
};
