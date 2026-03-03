const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const { execSync } = require('child_process');

const SAMPLE_RATE = 44100;

function writeMp3(outDir, name, samples) {
    const buf = Buffer.alloc(44 + samples.length * 2);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + samples.length * 2, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1,  20);
    buf.writeUInt16LE(1,  22);
    buf.writeUInt32LE(SAMPLE_RATE,     24);
    buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
    buf.writeUInt16LE(2,  32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(samples.length * 2, 40);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        buf.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
    }

    const tmp = path.join(os.tmpdir(), `${name}_tmp.wav`);
    fs.writeFileSync(tmp, buf);
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

// ---------------------------------------------------------
// Sound Generators (Card Game Themed, Higher Quality)
// ---------------------------------------------------------

function generatePlayCard() {
    // "Crisp snap as card hits table"
    const duration = 0.15;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    let lowpassOut = 0;
    
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 35); // Very fast decay
        
        // White noise for paper friction
        const noise = (Math.random() * 2 - 1);
        lowpassOut = lowpassOut + 0.3 * (noise - lowpassOut); 
        
        // Low thump of the table hit
        const thump = Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 15);
        
        // Combine paper swish and table thump
        samples[i] = (lowpassOut * 0.4 + thump * 0.45) * env;
    }
    return samples;
}

function generateBuyCard() {
    // "Satisfying chime over a paper slide"
    const duration = 0.6;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    let lowpassOut = 0;

    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        
        // Paper slide sound
        const slideEnv = Math.exp(-t * 22);
        const noise = (Math.random() * 2 - 1);
        lowpassOut = lowpassOut + 0.15 * (noise - lowpassOut);
        const paperSlide = lowpassOut * slideEnv * 0.3;
        
        // Bright Chime Roll (Major chord: C5, E5, G5, C6)
        const chimeEnv = Math.exp(-t * 6);
        let chime = 0;
        
        // Arpeggiate the chime notes progressively
        if (t > 0.00) chime += Math.sin(2 * Math.PI * 523.25 * t) * 0.25; // C5
        if (t > 0.04) chime += Math.sin(2 * Math.PI * 659.25 * (t - 0.04)) * 0.25; // E5
        if (t > 0.08) chime += Math.sin(2 * Math.PI * 783.99 * (t - 0.08)) * 0.25; // G5
        if (t > 0.12) chime += Math.sin(2 * Math.PI * 1046.50 * (t - 0.12)) * 0.25; // C6
        
        samples[i] = paperSlide + chime * chimeEnv * 0.5;
    }
    return samples;
}

function generateError() {
    // "Dull rejection buzz/thud"
    const duration = 0.3;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 12);
        
        // Two square waveforms slightly detuned for dissonance
        const freq1 = 120 - 40 * t;  // slight pitch bend down
        const freq2 = 111 - 40 * t;  // slight pitch bend down
        
        const sq1 = Math.sign(Math.sin(2 * Math.PI * freq1 * t));
        const sq2 = Math.sign(Math.sin(2 * Math.PI * freq2 * t));
        
        samples[i] = (sq1 + sq2) * 0.15 * env;
    }
    return samples;
}

function generateGainCoin() {
    // "Metallic Clink (Coins dropping together)"
    const duration = 0.5;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 8);
        
        // Multiple high frequency inharmonic sine waves for a bell/coin tone
        const v1 = Math.sin(2 * Math.PI * 2240 * t);
        const v2 = Math.sin(2 * Math.PI * 2890 * t);
        const v3 = Math.sin(2 * Math.PI * 4150 * t);
        const v4 = Math.sin(2 * Math.PI * 5500 * t);
        
        // Impact noise (very short)
        const attackEnv = Math.exp(-t * 100);
        const noise = (Math.random() * 2 - 1) * attackEnv;
        
        samples[i] = (v1 * 0.2 + v2 * 0.15 + v3 * 0.15 + v4 * 0.1 + noise * 0.4) * env * 0.7;
    }
    return samples;
}

function generateShuffle() {
    // "Rhythmic fluttering of card edges"
    const duration = 0.6;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    let lowpassOut = 0;

    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;

        // Envelope creates 5~6 distinct snaps for the riffle shuffle
        const flutter = Math.pow(Math.abs(Math.sin(2 * Math.PI * 10 * t)), 4);
        const env = Math.exp(-t * 4) * flutter;

        // Broad noise filtered for paper texture
        const noise = Math.random() * 2 - 1;
        lowpassOut = lowpassOut + 0.3 * (noise - lowpassOut);

        samples[i] = lowpassOut * env * 0.75;
    }
    return samples;
}

function generateGainBuy() {
    // "Bright guitar chord strum — A major arpeggio"
    const duration = 0.55;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    const freqs   = [440, 554, 659, 880];   // A4, C#5, E5, A5
    const delays  = [0, 0.010, 0.022, 0.035];
    const phases  = freqs.map(() => 0);

    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        let s = 0;
        freqs.forEach((f, fi) => {
            if (t < delays[fi]) return;
            const lt  = t - delays[fi];
            const env = Math.exp(-lt * 6.5);
            s += (Math.sin(phases[fi])         * 0.50
                + Math.sin(phases[fi] * 2)     * 0.22
                + Math.sin(phases[fi] * 3)     * 0.10) * env;
            phases[fi] += 2 * Math.PI * f / SAMPLE_RATE;
        });
        const atkNoise = (Math.random() * 2 - 1) * Math.exp(-t * 110) * 0.28;
        samples[i] = (s / freqs.length + atkNoise) * 0.80;
    }
    return samples;
}

function generateGainAction() {
    // "Military trumpet: short two-note fanfare G4 → C5"
    const duration = 0.45;
    const samples  = new Float32Array(SAMPLE_RATE * duration);
    let phase = 0;

    for (let i = 0; i < samples.length; i++) {
        const t    = i / SAMPLE_RATE;
        const freq = t < 0.18 ? 392 : 523;   // G4 → C5
        const attack  = Math.min(t * 90, 1);
        const release = t > 0.32 ? Math.exp(-(t - 0.32) * 20) : 1;
        const env = attack * release;

        // Brass harmonic series (odd harmonics emphasis)
        const s = Math.sin(phase)       * 0.40
                + Math.sin(phase * 2)   * 0.28
                + Math.sin(phase * 3)   * 0.17
                + Math.sin(phase * 4)   * 0.09
                + Math.sin(phase * 5)   * 0.04;

        phase += 2 * Math.PI * freq / SAMPLE_RATE;
        samples[i] = s * env * 0.55;
    }
    return samples;
}

function generateGainVP() {
    // "Military bass drum: two deep strokes"
    const duration = 0.60;
    const samples  = new Float32Array(SAMPLE_RATE * duration);
    const hits     = [0, 0.22];   // two beats

    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        let s = 0;
        hits.forEach(ht => {
            if (t < ht) return;
            const lt   = t - ht;
            const freq = 85 * Math.exp(-lt * 10);   // pitch bends down on impact
            const body = Math.sin(2 * Math.PI * freq * lt) * Math.exp(-lt * 12);
            const atk  = (Math.random() * 2 - 1)           * Math.exp(-lt * 90);
            s += body * 0.55 + atk * 0.35;
        });
        samples[i] = s * 0.80;
    }
    return samples;
}

// ---------------------------------------------------------
// File generation  (MP3 only — delete leftover OGG / WAV)
// ---------------------------------------------------------
const outDir = path.join(__dirname, '..', 'src', 'asset', 'audio');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sfxNames = ['playCard', 'buyCard', 'error', 'gainCoin', 'shuffle', 'gainBuy', 'gainAction', 'gainVP'];
fs.readdirSync(outDir)
    .filter(f => sfxNames.some(n => f.startsWith(n)) && (f.endsWith('.ogg') || f.endsWith('.wav')))
    .forEach(f => { fs.unlinkSync(path.join(outDir, f)); console.log(`  deleted ${f}`); });

writeMp3(outDir, 'playCard',    generatePlayCard());
writeMp3(outDir, 'buyCard',     generateBuyCard());
writeMp3(outDir, 'error',       generateError());
writeMp3(outDir, 'gainCoin',    generateGainCoin());
writeMp3(outDir, 'shuffle',     generateShuffle());
writeMp3(outDir, 'gainBuy',     generateGainBuy());
writeMp3(outDir, 'gainAction',  generateGainAction());
writeMp3(outDir, 'gainVP',      generateGainVP());

console.log('SFX Generation Complete — 8 × MP3');