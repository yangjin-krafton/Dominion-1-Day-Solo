/**
 * generate_bgm.js — Classical / Baroque BGM Stems for Dominion
 *
 * 4 channels × 4 variations = 16 stems → MP3 only (128 kbps)
 *
 *   drone  → Cello basso continuo   (bowed, pizzicato bass)
 *   lute   → Classical Guitar       (nylon-string ornamental arpeggios)
 *   flute  → Baroque flute          (lyrical lead melody)
 *   perc   → Timpani                (soft orchestral pulse)
 *
 * Key: D Dorian (D E F G A B C)  |  Tempo: BPM 120 (4/4)
 */

'use strict';
const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const { execSync } = require('child_process');

const SAMPLE_RATE = 44100;
const TAU = Math.PI * 2;

// ── Timing (BPM = 120) ────────────────────────────────────────
const T16 = 0.125;   // 16th note
const T8  = 0.25;    // 8th  note
const T4  = 0.50;    // quarter note

// ── WAV buffer + MP3 writer ────────────────────────────────────
function buildWavBuffer(samples) {
    const buf = Buffer.alloc(44 + samples.length * 2);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + samples.length * 2, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1,  20);  // PCM
    buf.writeUInt16LE(1,  22);  // mono
    buf.writeUInt32LE(SAMPLE_RATE,     24);
    buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
    buf.writeUInt16LE(2,  32);  // block align
    buf.writeUInt16LE(16, 34);  // 16-bit
    buf.write('data', 36);
    buf.writeUInt32LE(samples.length * 2, 40);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        buf.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
    }
    return buf;
}

function writeStem(outDir, name, samples) {
    const tmp = path.join(os.tmpdir(), `${name}_tmp.wav`);
    fs.writeFileSync(tmp, buildWavBuffer(samples));
    try {
        execSync(
            `ffmpeg -y -loglevel error -i "${tmp}" -c:a libmp3lame -b:a 128k "${path.join(outDir, name + '.mp3')}"`,
            { stdio: 'inherit' }
        );
    } finally {
        fs.unlinkSync(tmp);
    }
    console.log(`  ✓ ${name}.mp3`);
}

// ── D Dorian frequency table ──────────────────────────────────
const N = {
    D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
    A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66,
    E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00,
    B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
    F5: 698.46,
};

// ── Primitives ────────────────────────────────────────────────
const lf       = (f, dur) => Math.round(f * dur) / dur;          // loop-align freq
const softClip = (x)      => Math.tanh(x * 0.70) / Math.tanh(0.70);
const sine     = (f, t)   => Math.sin(TAU * f * t);

// Pseudo-noise for breath and bow transients (stateless hash)
function nz(t, rate = 8000) {
    let s = (Math.floor(t * rate) * 1664525 + 1013904223) | 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b | 0) ^ (s >>> 11);
    return (s & 0xffff) / 32768.0 - 1.0;
}

// Smooth ADSR envelope  (nt = time since note onset, len = note duration)
function adsr(nt, len, atk, dcy, sus, rel = 0.05) {
    if (nt < 0 || nt >= len) return 0;
    if (nt < atk) return nt / atk;
    if (nt < atk + dcy) return 1 - (1 - sus) * (nt - atk) / dcy;
    if (nt > len - rel) return sus * Math.max(0, (len - nt) / rel);
    return sus;
}

function gen(duration, fn) {
    const n = Math.round(SAMPLE_RATE * duration);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = fn(i / SAMPLE_RATE);
    return out;
}

// Step-sequencer helpers
function step(pat, t, iv)  { return pat[Math.floor((t % (pat.length * iv)) / iv)]; }
function stepT(pat, t, iv) {
    const loc = t % (pat.length * iv);
    return loc - Math.floor(loc / iv) * iv;
}

// ════════════════════════════════════════════════════════════
//  Instrument synthesis
// ════════════════════════════════════════════════════════════

// CLASSICAL GUITAR: nylon-string pluck — warm, rounded overtones
function classicalGuitar(f, nt) {
    const partials = [1.0, 0.45, 0.28, 0.18, 0.10, 0.06, 0.03];
    let v = 0;
    for (let i = 0; i < partials.length; i++) v += sine(f * (i + 1), nt) * partials[i];
    // Warmer, slower decay than harpsichord (nylon string, finger pluck)
    const env   = Math.exp(-nt * 4.8) * 0.32 + Math.exp(-nt * 1.2) * 0.68;
    const pluck = nz(nt, 2500) * Math.exp(-nt * 60) * 0.06;  // finger-nail transient
    return softClip((v * env + pluck) / 2.1);
}

// BAROQUE FLUTE: breathy, pure tone with gentle vibrato
function baroqueFlute(f, nt, vibHz = 5.5) {
    const vib  = 1 + sine(vibHz, nt) * 0.006 * Math.min(1, nt * 6);
    const fv   = f * vib;
    const body = sine(fv, nt) * 0.72 + sine(fv * 2, nt) * 0.17 + sine(fv * 3, nt) * 0.07;
    return body + nz(nt, 9500) * 0.020;  // breath noise
}

// CELLO: deeper bowed tone, warm low-register color
function cello(f, nt) {
    const vib = 1 + sine(4.8, nt) * 0.004 * Math.min(1, nt * 6);
    const fv  = f * vib;
    return softClip(
        sine(fv, nt) * 0.65 + sine(fv * 2, nt) * 0.28 +
        sine(fv * 3, nt) * 0.14 + sine(fv * 4, nt) * 0.07
    );
}

// ════════════════════════════════════════════════════════════
//  1. DRONE — Cello basso continuo
// ════════════════════════════════════════════════════════════
function makeCello(duration, pattern, interval, gain = 0.32) {
    return gen(duration, (t) => {
        const f  = step(pattern, t, interval);
        if (!f) return 0;
        const nt = stepT(pattern, t, interval);
        const e  = adsr(nt, interval, 0.012, 0.06, 0.74, 0.05);
        return cello(lf(f, duration), nt) * e * gain;
    });
}

// drone1: Walking continuo bass, 8th notes (16 × T8 = 4 s → 6 loops in 24 s)
const drone1 = makeCello(24, [
    N.D3, N.F3, N.A3, N.G3,   N.F3, N.E3, N.F3, N.A3,
    N.C4, N.A3, N.G3, N.A3,   N.D3, N.E3, N.F3, N.D3,
], T8, 0.34);

// drone2: Melodic bass, stepwise motion (16 × T8 = 4 s → 6 loops)
const drone2 = makeCello(24, [
    N.A3, N.G3, N.F3, N.E3,   N.D3, N.E3, N.F3, N.G3,
    N.A3, N.C4, N.D4, N.C4,   N.A3, N.G3, N.A3, N.D3,
], T8, 0.30);

// drone3: Quarter-note pizzicato bass (8 × T4 = 4 s → 6 loops)
const drone3 = makeCello(24, [
    N.D3, N.A3, N.G3, N.A3,   N.F3, N.G3, N.A3, N.D3,
], T4, 0.36);


// ════════════════════════════════════════════════════════════
//  2. LUTE — Classical Guitar ornamental arpeggios
// ════════════════════════════════════════════════════════════
function makeGuitar(duration, pattern, interval, gain = 0.20) {
    return gen(duration, (t) => {
        const f  = step(pattern, t, interval);
        if (!f) return 0;
        const nt = stepT(pattern, t, interval);
        return classicalGuitar(lf(f, duration), nt) * gain;
    });
}

// lute1: 16th-note arpeggio figures (32 × T16 = 4 s → 4 loops in 16 s)
const lute1 = makeGuitar(16, [
    N.D4, N.F4, N.A4, N.D5,   N.C5, N.A4, N.F4, N.D4,
    N.E4, N.G4, N.C5, N.G4,   N.E4, N.C4, N.E4, N.G4,
    N.F4, N.A4, N.D5, N.A4,   N.F4, N.D4, N.F4, N.A4,
    N.G4, N.B3, N.D4, N.G4,   N.D4, N.B3, N.G3, N.B3,
], T16, 0.22);

// lute2: Scalar runs ascending and descending (32 × T8 = 8 s → 2 loops)
const lute2 = makeGuitar(16, [
    N.D4, N.E4, N.F4, N.G4,   N.A4, N.B4, N.C5, N.D5,
    N.E5, N.D5, N.C5, N.B4,   N.A4, N.G4, N.F4, N.E4,
    N.D4, N.F4, N.E4, N.D4,   N.E4, N.F4, N.G4, N.A4,
    N.B4, N.A4, N.G4, N.F4,   N.E4, N.D4, N.C4, N.D4,
], T8, 0.20);

// lute3: Alberti-bass keyboard texture (32 × T8 = 8 s → 2 loops)
const lute3 = makeGuitar(16, [
    N.D4, N.A4, N.F4, N.A4,   N.D4, N.A4, N.F4, N.A4,
    N.C4, N.G4, N.E4, N.G4,   N.C4, N.G4, N.E4, N.G4,
    N.F3, N.C4, N.A3, N.C4,   N.F3, N.C4, N.A3, N.C4,
    N.G3, N.D4, N.B3, N.D4,   N.G3, N.D4, N.B3, N.D4,
], T8, 0.18);


// ════════════════════════════════════════════════════════════
//  3. FLUTE — Baroque flute lyrical lead
// ════════════════════════════════════════════════════════════
function makeFlute(duration, pattern, interval, gain = 0.22) {
    return gen(duration, (t) => {
        const f  = step(pattern, t, interval);
        if (!f) return 0;
        const nt = stepT(pattern, t, interval);
        const e  = adsr(nt, interval * 0.90, 0.018, 0.06, 0.80, 0.04);
        return softClip(baroqueFlute(lf(f, duration), nt) * e * gain);
    });
}

// flute1: Flowing D-Dorian theme, quarter notes (20 × T4 = 10 s → 2 loops in 20 s)
const flute1 = makeFlute(20, [
    N.D5, N.E5, N.F5, N.E5,   N.D5, N.C5, N.B4, N.A4,
    N.G4, N.A4, N.B4, N.C5,   N.D5, N.C5, N.B4, N.A4,
    N.G4, N.F4, N.E4, N.D4,
], T4, 0.24);

// flute2: Running 8th-note scalar passage (40 × T8 = 10 s → 2 loops)
const flute2 = makeFlute(20, [
    N.D4, N.E4, N.F4, N.G4,   N.A4, N.B4, N.C5, N.D5,
    N.E5, N.D5, N.C5, N.B4,   N.A4, N.G4, N.F4, N.E4,
    N.D4, N.F4, N.E4, N.D4,   N.E4, N.F4, N.G4, N.A4,
    N.B4, N.A4, N.G4, N.F4,   N.E4, N.D4, N.C4, N.D4,
    N.E4, N.G4, N.F4, N.E4,   N.D4, N.C4, N.D4, N.E4,
], T8, 0.22);

// flute3: Ornamented motif (trill-like neighbour notes), 8th notes (40 × T8 = 10 s)
const flute3 = makeFlute(20, [
    N.A4, N.B4, N.A4, N.G4,   N.F4, N.G4, N.A4, N.B4,
    N.C5, N.B4, N.A4, N.G4,   N.F4, N.E4, N.F4, N.G4,
    N.A4, N.G4, N.F4, N.E4,   N.D4, N.E4, N.F4, N.E4,
    N.D4, N.C4, N.D4, N.E4,   N.F4, N.G4, N.A4, N.B4,
    N.C5, N.A4, N.B4, N.G4,   N.A4, N.F4, N.G4, N.D4,
], T8, 0.20);


// ════════════════════════════════════════════════════════════
//  4. PERC — Timpani
// ════════════════════════════════════════════════════════════
function makeTimpani(duration, hits, patLen, gain = 0.48) {
    return gen(duration, (t) => {
        const local = t % patLen;
        let v = 0;
        for (const h of hits) {
            const dt = local - h.time;
            if (dt < 0 || dt > 1.8) continue;
            const freq = (h.pitch ?? 85) * (1 + 0.16 * Math.exp(-dt * 12));
            const env  = Math.exp(-dt * 2.4);
            v += (sine(freq, dt) * 0.70 + sine(freq * 2.3, dt) * 0.14) * env * h.amp;
        }
        return softClip(v * gain);
    });
}

// perc1: Steady quarter-note pulse  (D and A drums, 4 s pattern = 2 bars)
const perc1 = makeTimpani(20, [
    { time: 0.0, amp: 0.90, pitch: 85  },  // D
    { time: 1.0, amp: 0.55, pitch: 85  },
    { time: 2.0, amp: 0.85, pitch: 110 },  // A
    { time: 3.0, amp: 0.52, pitch: 110 },
], 4.0, 0.50);

// perc2: Baroque dotted-rhythm feel (♩. ♪ pattern, 4 s)
const perc2 = makeTimpani(20, [
    { time: 0.00, amp: 0.95, pitch: 85  },
    { time: 0.75, amp: 0.50, pitch: 100 },
    { time: 1.50, amp: 0.80, pitch: 85  },
    { time: 2.25, amp: 0.45, pitch: 100 },
    { time: 3.00, amp: 0.90, pitch: 85  },
    { time: 3.75, amp: 0.50, pitch: 110 },
], 4.0, 0.48);

// perc3: Grand, emphatic on strong beats only (8 s pattern = 4 bars)
const perc3 = makeTimpani(20, [
    { time: 0.0, amp: 1.00, pitch: 85  },
    { time: 2.0, amp: 0.88, pitch: 110 },
    { time: 4.0, amp: 1.00, pitch: 85  },
    { time: 6.0, amp: 0.88, pitch: 110 },
], 8.0, 0.52);


// ════════════════════════════════════════════════════════════
//  4th variations  (distinct character from variations 1–3)
// ════════════════════════════════════════════════════════════

// drone4: Half-note bass — slow, breathing descent
const drone4 = makeCello(24, [
    N.D3, N.D3, N.F3, N.A3,   N.G3, N.F3, N.E3, N.D3,
    N.A3, N.G3, N.F3, N.G3,   N.A3, N.C4, N.A3, N.D3,
], T8, 0.32);

// lute4: Slow quarter-note chord arpeggio — lyrical, singing guitar (32 × T4 = 16 s)
const lute4 = makeGuitar(16, [
    N.D4, N.A3, N.D4, N.F4,   N.A4, N.F4, N.E4, N.D4,
    N.C4, N.G3, N.C4, N.E4,   N.G4, N.E4, N.D4, N.C4,
    N.F3, N.C4, N.F3, N.A3,   N.C4, N.A3, N.G3, N.F3,
    N.G3, N.D4, N.G3, N.B3,   N.D4, N.B3, N.A3, N.G3,
], T4, 0.20);

// flute4: High-register ornamental motif (20 × T4 = 10 s → 2 loops in 20 s)
const flute4 = makeFlute(20, [
    N.E5, N.D5, N.E5, N.F5,   N.E5, N.D5, N.C5, N.B4,
    N.A4, N.B4, N.C5, N.D5,   N.E5, N.D5, N.C5, N.A4,
    N.G4, N.A4, N.B4, N.C5,
], T4, 0.22);

// perc4: 8th-note pulse timpani — more active, driving
const perc4 = makeTimpani(20, [
    { time: 0.00, amp: 0.90, pitch: 85  },
    { time: 0.50, amp: 0.60, pitch: 110 },
    { time: 1.00, amp: 0.85, pitch: 85  },
    { time: 1.50, amp: 0.55, pitch: 110 },
    { time: 2.00, amp: 0.95, pitch: 85  },
    { time: 2.50, amp: 0.60, pitch: 100 },
    { time: 3.00, amp: 0.80, pitch: 85  },
    { time: 3.75, amp: 0.55, pitch: 110 },
], 4.0, 0.50);

// ════════════════════════════════════════════════════════════
//  Write output  (MP3 only — delete ALL existing bgm files)
// ════════════════════════════════════════════════════════════
const outDir = path.join(__dirname, '..', 'src', 'asset', 'audio');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.readdirSync(outDir)
    .filter(f => f.startsWith('bgm_') && (f.endsWith('.mp3') || f.endsWith('.ogg') || f.endsWith('.wav')))
    .forEach(f => { fs.unlinkSync(path.join(outDir, f)); console.log(`  deleted ${f}`); });

const stems = [
    ['bgm_drone1', drone1], ['bgm_drone2', drone2], ['bgm_drone3', drone3], ['bgm_drone4', drone4],
    ['bgm_lute1',  lute1],  ['bgm_lute2',  lute2],  ['bgm_lute3',  lute3],  ['bgm_lute4',  lute4],
    ['bgm_flute1', flute1], ['bgm_flute2', flute2], ['bgm_flute3', flute3], ['bgm_flute4', flute4],
    ['bgm_perc1',  perc1],  ['bgm_perc2',  perc2],  ['bgm_perc3',  perc3],  ['bgm_perc4',  perc4],
];

for (const [name, data] of stems) writeStem(outDir, name, data);

console.log(`\nDone — ${stems.length} MP3 stems  (4 channels × 4 variations)`);
