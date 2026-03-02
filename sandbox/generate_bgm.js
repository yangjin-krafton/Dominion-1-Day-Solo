const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const TAU = Math.PI * 2;

function writeWav(filename, samples) {
    const buffer = Buffer.alloc(44 + samples.length * 2);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples.length * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples.length * 2, 40);

    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
    }

    fs.writeFileSync(filename, buffer);
    console.log(`Generated ${filename}`);
}

const loopFreq = (freq, duration) => Math.round(freq * duration) / duration;
const softClip = (x) => Math.tanh(x * 1.15);
const sine = (f, t) => Math.sin(TAU * f * t);

function generateInstrument(duration, renderLogic) {
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        samples[i] = renderLogic(i / SAMPLE_RATE, duration);
    }
    return samples;
}

// D Dorian palette for medieval court / guild mood.
const N = {
    D3: 146.83,
    F3: 174.61,
    G3: 196.00,
    A3: 220.00,
    B3: 246.94,
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.00,
    A4: 440.00,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25
};

function pluck(freq, noteT, duration, decay = 6.5, tone = 0.27) {
    if (freq <= 0) return 0;
    const f = loopFreq(freq, duration);
    const env = Math.exp(-noteT * decay);
    if (env < 0.0008) return 0;

    const body =
        sine(f, noteT) +
        sine(f * 2.01, noteT) * 0.42 +
        sine(f * 3.02, noteT) * 0.2;
    const pick = sine(1750, noteT) * Math.exp(-noteT * 30) * 0.05;
    return softClip((body * tone + pick) * env);
}

function bowed(freq, t, vibHz = 4.8, vibDepth = 0.0035) {
    const v = 1 + Math.sin(TAU * vibHz * t) * vibDepth;
    const f = freq * v;
    return sine(f, t) * 0.7 + sine(f * 2, t) * 0.22 + sine(f * 3, t) * 0.1;
}

function flute(freq, t, breath = 0.08) {
    const body = sine(freq, t) * 0.78 + sine(freq * 2, t) * 0.14 + sine(freq * 3, t) * 0.06;
    const airy = sine(1700, t) * breath;
    return body + airy;
}

function noteByStep(pattern, step) {
    return pattern[step % pattern.length];
}

function makeStepMelody(duration, beatSec, notes, voiceFn, gain = 0.20, offset = 0) {
    return generateInstrument(duration, (t, d) => {
        const local = (t + offset) % d;
        const step = Math.floor(local / beatSec);
        const noteT = local - step * beatSec;
        const freq = noteByStep(notes, step);
        if (freq <= 0) return 0;

        const atk = Math.min(1, noteT / 0.07);
        const rel = Math.exp(-noteT * 1.8);
        const env = atk * rel;

        return softClip(voiceFn(loopFreq(freq, d), noteT) * env * gain);
    });
}

function makeDrone(duration, tones, lfoHz, gain) {
    return generateInstrument(duration, (t, d) => {
        const lfo = 0.62 + 0.38 * Math.sin(TAU * loopFreq(lfoHz, d) * t + 0.9);
        let v = 0;
        for (let i = 0; i < tones.length; i++) {
            const f = loopFreq(tones[i], d);
            v += sine(f, t) * (0.55 / (1 + i * 0.55));
        }
        return softClip(v * lfo * gain);
    });
}

function makeLute(duration, interval, notes, offset = 0, gain = 1) {
    return generateInstrument(duration, (t, d) => {
        const shifted = (t + offset) % d;
        const step = Math.floor(shifted / interval);
        const noteT = shifted - step * interval;
        const f = noteByStep(notes, step);
        return pluck(f, noteT, d, 6.5, 0.27) * 0.9 * gain;
    });
}

function makeChoir(duration, chords, chordLen, gain = 0.22, offset = 0) {
    return generateInstrument(duration, (t, d) => {
        const local = (t + offset) % d;
        const idx = Math.floor(local / chordLen) % chords.length;
        const chord = chords[idx];
        const chordT = local - Math.floor(local / chordLen) * chordLen;
        const swell = 0.55 + 0.45 * Math.sin((chordT / chordLen) * Math.PI);

        let v = 0;
        for (let i = 0; i < chord.length; i++) {
            const f = loopFreq(chord[i], d);
            v += sine(f, t) * (0.44 / (1 + i * 0.4));
            v += sine(f * 2, t) * (0.12 / (1 + i * 0.5));
        }
        return softClip(v * swell * gain);
    });
}

function drumHit(localT, hitTime, baseFreq, amp = 1) {
    const dt = localT - hitTime;
    if (dt < 0 || dt > 0.36) return 0;

    const env = Math.exp(-dt * 11.5);
    const pitch = Math.max(48, baseFreq - dt * 130);
    const body = sine(pitch, dt) * 0.85;
    const skin = sine(980, dt) * Math.exp(-dt * 28) * 0.11;
    return softClip((body + skin) * env * amp);
}

function tambour(localT, hitTime, amp = 1) {
    const dt = localT - hitTime;
    if (dt < 0 || dt > 0.14) return 0;
    const env = Math.exp(-dt * 30);
    const jingle = (sine(2300, dt) + sine(3400, dt) * 0.7) * env;
    return jingle * 0.06 * amp;
}

function makePerc(duration, patternDuration, hits, jangles, baseFreq, gain) {
    return generateInstrument(duration, (t, d) => {
        const local = t % patternDuration;
        let v = 0;
        for (const hit of hits) {
            v += drumHit(local, hit.time, baseFreq * hit.pitchMul, hit.amp);
        }
        for (const j of jangles) {
            v += tambour(local, j.time, j.amp);
        }
        const lowDrone = sine(loopFreq(N.D3, d), t) * 0.08;
        return softClip((v + lowDrone) * gain);
    });
}

// 1) Drone (sustained foundation)
const drone1 = makeDrone(24, [N.D3, N.A3, N.D4], 0.03125, 0.34);
const drone2 = makeDrone(24, [N.F3, N.C4, N.A3], 0.046875, 0.32);
const drone3 = makeDrone(24, [N.G3, N.D4, N.F4], 0.0625, 0.28);

// 2) Lute (main boardgame arpeggio color)
const lute1 = makeLute(18, 0.75, [N.D4, N.F4, N.A4, N.F4, N.G4, N.E4, N.D4, 0], 0.0, 1.0);
const lute2 = makeLute(18, 0.5, [N.A4, 0, N.G4, N.F4, N.E4, 0, N.D4, N.C4, N.D4, 0], 0.2, 0.92);
const lute3 = makeLute(18, 1.0, [N.F4, N.A4, N.G4, N.D4, N.E4, N.C4], 1.0, 0.98);

// 3) Flute (lead motif)
const flute1 = makeStepMelody(
    20,
    1.0,
    [N.A4, N.C5, N.D5, N.C5, N.A4, N.G4, N.F4, 0, N.G4, N.A4, N.C5, N.D5, 0, N.C5, N.A4, N.G4, N.F4, 0, N.E4, N.D4],
    (f, nt) => flute(f, nt, 0.03),
    0.23,
    0.0
);
const flute2 = makeStepMelody(
    20,
    0.5,
    [N.D5, 0, N.C5, 0, N.A4, N.G4, N.F4, 0, N.E4, N.F4, N.G4, 0, N.A4, 0, N.C5, 0],
    (f, nt) => flute(f, nt, 0.04),
    0.19,
    0.5
);
const flute3 = makeStepMelody(
    20,
    1.5,
    [N.F4, N.G4, N.A4, N.C5, N.A4, N.G4, N.E4, N.D4],
    (f, nt) => flute(f, nt, 0.035),
    0.21,
    1.0
);

// 4) Viola/Viol (counter melody)
const viol1 = makeStepMelody(
    22,
    1.0,
    [N.D4, N.F4, N.G4, N.A4, N.F4, N.E4, N.D4, N.C4, N.D4, N.F4, N.A4, N.G4],
    (f, nt) => bowed(f, nt, 5.0, 0.004),
    0.22,
    0.0
);
const viol2 = makeStepMelody(
    22,
    0.75,
    [N.A3, N.C4, N.D4, N.F4, N.E4, N.D4, N.C4, 0, N.D4, N.E4, N.F4, N.G4],
    (f, nt) => bowed(f, nt, 4.6, 0.003),
    0.20,
    0.25
);
const viol3 = makeStepMelody(
    22,
    1.25,
    [N.F3, N.A3, N.C4, N.D4, N.C4, N.A3, N.G3, N.F3],
    (f, nt) => bowed(f, nt, 4.2, 0.0035),
    0.24,
    0.8
);

// 5) Choir (guild hall ambience)
const choirChords = [
    [N.D4, N.F4, N.A4],
    [N.C4, N.E4, N.G4],
    [N.F3, N.A3, N.C4],
    [N.G3, N.B3, N.D4]
];

const choir1 = makeChoir(24, choirChords, 6.0, 0.20, 0.0);
const choir2 = makeChoir(24, [choirChords[2], choirChords[0], choirChords[3], choirChords[1]], 6.0, 0.18, 0.7);
const choir3 = makeChoir(24, [choirChords[1], choirChords[3], choirChords[0], choirChords[2]], 6.0, 0.19, 1.3);

// 6) Percussion (frame drum + tambour accents)
const perc1 = makePerc(
    20,
    4.0,
    [
        { time: 0.0, amp: 1.0, pitchMul: 1.0 },
        { time: 1.0, amp: 0.72, pitchMul: 1.03 },
        { time: 2.0, amp: 0.92, pitchMul: 0.97 },
        { time: 3.0, amp: 0.68, pitchMul: 1.06 }
    ],
    [
        { time: 0.5, amp: 0.7 },
        { time: 1.5, amp: 0.6 },
        { time: 2.5, amp: 0.75 },
        { time: 3.5, amp: 0.6 }
    ],
    N.D3,
    0.66
);

const perc2 = makePerc(
    20,
    4.0,
    [
        { time: 0.0, amp: 1.0, pitchMul: 1.0 },
        { time: 0.75, amp: 0.56, pitchMul: 1.12 },
        { time: 1.5, amp: 0.86, pitchMul: 0.95 },
        { time: 2.25, amp: 0.62, pitchMul: 1.08 },
        { time: 3.0, amp: 0.88, pitchMul: 0.97 },
        { time: 3.5, amp: 0.54, pitchMul: 1.15 }
    ],
    [
        { time: 0.5, amp: 0.55 },
        { time: 1.25, amp: 0.48 },
        { time: 2.75, amp: 0.6 },
        { time: 3.75, amp: 0.52 }
    ],
    N.C4,
    0.63
);

const perc3 = makePerc(
    20,
    2.0,
    [
        { time: 0.0, amp: 0.94, pitchMul: 1.0 },
        { time: 0.5, amp: 0.52, pitchMul: 1.2 },
        { time: 1.0, amp: 0.9, pitchMul: 0.93 },
        { time: 1.5, amp: 0.58, pitchMul: 1.14 }
    ],
    [
        { time: 0.25, amp: 0.5 },
        { time: 0.75, amp: 0.55 },
        { time: 1.25, amp: 0.5 },
        { time: 1.75, amp: 0.58 }
    ],
    N.F3,
    0.60
);

const outDir = path.join(__dirname, '..', 'src', 'asset', 'audio');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

writeWav(path.join(outDir, 'bgm_drone1.wav'), drone1);
writeWav(path.join(outDir, 'bgm_drone2.wav'), drone2);
writeWav(path.join(outDir, 'bgm_drone3.wav'), drone3);

writeWav(path.join(outDir, 'bgm_lute1.wav'), lute1);
writeWav(path.join(outDir, 'bgm_lute2.wav'), lute2);
writeWav(path.join(outDir, 'bgm_lute3.wav'), lute3);

writeWav(path.join(outDir, 'bgm_flute1.wav'), flute1);
writeWav(path.join(outDir, 'bgm_flute2.wav'), flute2);
writeWav(path.join(outDir, 'bgm_flute3.wav'), flute3);

writeWav(path.join(outDir, 'bgm_viol1.wav'), viol1);
writeWav(path.join(outDir, 'bgm_viol2.wav'), viol2);
writeWav(path.join(outDir, 'bgm_viol3.wav'), viol3);

writeWav(path.join(outDir, 'bgm_choir1.wav'), choir1);
writeWav(path.join(outDir, 'bgm_choir2.wav'), choir2);
writeWav(path.join(outDir, 'bgm_choir3.wav'), choir3);

writeWav(path.join(outDir, 'bgm_perc1.wav'), perc1);
writeWav(path.join(outDir, 'bgm_perc2.wav'), perc2);
writeWav(path.join(outDir, 'bgm_perc3.wav'), perc3);

console.log('Generated Medieval BGM Stems (6 instruments x 3 variations = 18 files) Complete!');
