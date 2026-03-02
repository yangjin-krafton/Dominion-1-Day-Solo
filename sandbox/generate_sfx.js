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

// ---------------------------------------------------------
// File generation  (MP3 only — delete leftover OGG / WAV)
// ---------------------------------------------------------
const outDir = path.join(__dirname, '..', 'src', 'asset', 'audio');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sfxNames = ['playCard', 'buyCard', 'error', 'gainCoin', 'shuffle'];
fs.readdirSync(outDir)
    .filter(f => sfxNames.some(n => f.startsWith(n)) && (f.endsWith('.ogg') || f.endsWith('.wav')))
    .forEach(f => { fs.unlinkSync(path.join(outDir, f)); console.log(`  deleted ${f}`); });

writeMp3(outDir, 'playCard', generatePlayCard());
writeMp3(outDir, 'buyCard',  generateBuyCard());
writeMp3(outDir, 'error',    generateError());
writeMp3(outDir, 'gainCoin', generateGainCoin());
writeMp3(outDir, 'shuffle',  generateShuffle());

console.log('SFX Generation Complete — 5 × MP3');