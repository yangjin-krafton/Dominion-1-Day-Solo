const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

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
        let sample = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
    }
    
    fs.writeFileSync(filename, buffer);
    console.log(`Generated ${filename}`);
}

const loopFreq = (freq, duration) => Math.round(freq * duration) / duration;

function generateInstrument(duration, renderLogic) {
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        samples[i] = renderLogic(i / SAMPLE_RATE, duration);
    }
    return samples;
}

// All notes in C Pentatonic to avoid dissonance when purely combined randomly:
// C (261.63), D (293.66), E (329.63), G (392.00), A (440.00)

// --- PAD Variations (Duration 16s) ---
// Pad 1: Focused on Root & Fifth (Warm, grounding)
const pad1 = generateInstrument(16, (t, d) => {
    let f1 = loopFreq(130.81, d); // C3
    let f2 = loopFreq(196.00, d); // G3
    let lfo = Math.sin(2 * Math.PI * loopFreq(0.125, d) * t) * 0.4 + 0.6;
    return (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.3 * lfo;
});
// Pad 2: Focused on Third & Sixth (Ethereal)
const pad2 = generateInstrument(16, (t, d) => {
    let f1 = loopFreq(164.81, d); // E3
    let f2 = loopFreq(220.00, d); // A3
    let lfo = Math.sin(2 * Math.PI * loopFreq(0.0625, d) * t) * 0.4 + 0.6;
    return (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.3 * lfo;
});
// Pad 3: Subtle High Shimmer
const pad3 = generateInstrument(16, (t, d) => {
    let f1 = loopFreq(392.00, d); // G4
    let f2 = loopFreq(523.25, d); // C5
    let lfo = Math.abs(Math.sin(2 * Math.PI * loopFreq(0.25, d) * t));
    return (Math.sin(2 * Math.PI * f1 * t) * 0.5 + Math.sin(2 * Math.PI * f2 * t) * 0.5) * 0.15 * lfo;
});

// --- PLUCK Variations (Duration 12s) ---
function makePluckPattern(d, interval, freqs, timeOffset = 0) {
    return (t, d) => {
        let val = 0;
        let tShifted = (t + timeOffset) % d;
        let step = Math.floor(tShifted / interval);
        let noteT = tShifted - step * interval;
        let f = loopFreq(freqs[step % freqs.length], d);
        let env = Math.exp(-noteT * 4);
        if (env > 0.001) {
            let osc = Math.sin(2 * Math.PI * f * noteT) + 
                      Math.sin(2 * Math.PI * loopFreq(f * 2, d) * noteT) * 0.4;
            val = osc * env * 0.2;
        }
        return val;
    }
}
// Pluck 1: Steady C-E-G (Arp up)
const pluck1 = generateInstrument(12, makePluckPattern(12, 1.5, [523.25, 659.25, 783.99, 659.25])); 
// Pluck 2: Syncopated A-G-D (Quicker, sparse)
const pluck2 = generateInstrument(12, makePluckPattern(12, 0.75, [880.00, 783.99, 587.33, 0, 880.00, 0, 783.99, 0])); 
// Pluck 3: Gentle Bells E-C-D (Offset start)
const pluck3 = generateInstrument(12, makePluckPattern(12, 2.0, [659.25, 523.25, 587.33, 659.25, 783.99, 523.25], 1.0)); 

// --- BASS Variations (Duration 20s) ---
// Bass 1: Long C drone (Raised +1 Octave to C3, added saw/square harmonics)
const bass1 = generateInstrument(20, (t, d) => {
    let f1 = loopFreq(130.81, d); // C3 (was 65.41)
    let env = Math.sin(Math.PI * (t / d)); // One huge swell
    // Mix sine for fatness, small amount of square for audible buzz
    let sine = Math.sin(2 * Math.PI * f1 * t);
    let sq = Math.sign(Math.sin(2 * Math.PI * f1 * t));
    return (sine * 0.7 + sq * 0.15 + Math.sin(2 * Math.PI * f1 * 1.01 * t) * 0.15) * env * 0.5;
});
// Bass 2: Pulsing A -> G (Raised +1 Octave to A2 -> G2)
const bass2 = generateInstrument(20, (t, d) => {
    let f1 = t < 10 ? loopFreq(110.00, d) : loopFreq(98.00, d); // A2 -> G2
    let env = Math.max(0, Math.sin(Math.PI * ((t % 10) / 10)));
    let sine = Math.sin(2 * Math.PI * f1 * t);
    let saw = 2 * (t * f1 - Math.floor(t * f1 + 0.5));
    return (sine * 0.7 + saw * 0.3) * env * 0.6;
});
// Bass 3: Deep Sub E (Raised +1 Octave to E3)
const bass3 = generateInstrument(20, (t, d) => {
    let f1 = loopFreq(164.81, d); // E3 (was 82.41)
    let env = Math.sin(2 * Math.PI * (t / d)); // Two swells
    // Triangle + Sine for warmth and presence
    let sine = Math.sin(2 * Math.PI * f1 * t);
    let tri = Math.asin(Math.sin(2 * Math.PI * f1 * t)) * (2 / Math.PI);
    return (sine * 0.6 + tri * 0.4) * Math.abs(env) * 0.6;
});

const outDir = path.join(__dirname, '..', 'src', 'asset', 'audio');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

writeWav(path.join(outDir, 'bgm_pad1.wav'), pad1);
writeWav(path.join(outDir, 'bgm_pad2.wav'), pad2);
writeWav(path.join(outDir, 'bgm_pad3.wav'), pad3);
writeWav(path.join(outDir, 'bgm_pluck1.wav'), pluck1);
writeWav(path.join(outDir, 'bgm_pluck2.wav'), pluck2);
writeWav(path.join(outDir, 'bgm_pluck3.wav'), pluck3);
writeWav(path.join(outDir, 'bgm_bass1.wav'), bass1);
writeWav(path.join(outDir, 'bgm_bass2.wav'), bass2);
writeWav(path.join(outDir, 'bgm_bass3.wav'), bass3);

console.log("Generative Advanced BGM Stems (9 variations) Complete!");