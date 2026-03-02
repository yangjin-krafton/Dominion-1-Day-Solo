const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function writeWav(filename, samples) {
    const buffer = Buffer.alloc(44 + samples.length * 2);
    
    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples.length * 2, 4);
    buffer.write('WAVE', 8);
    
    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels
    buffer.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
    buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // ByteRate
    buffer.writeUInt16LE(2, 32); // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample
    
    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples.length * 2, 40);
    
    for (let i = 0; i < samples.length; i++) {
        let sample = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
    }
    
    fs.writeFileSync(filename, buffer);
    console.log(`Generated ${filename}`);
}

// Sound generators
function generatePlayCard() {
    const duration = 0.15;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 300 + (300 * Math.min(1, t / 0.1));
        const env = Math.exp(-t * 20);
        samples[i] = Math.sign(Math.sin(2 * Math.PI * freq * t)) * env * 0.2;
    }
    return samples;
}

function generateBuyCard() {
    const duration = 0.25;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const freq = t < 0.1 ? 600 : 800;
        const env = t < 0.1 ? Math.exp(-t * 30) : Math.exp(-(t-0.1) * 30);
        if (t >= 0.1 && t < 0.12) continue; // gap
        samples[i] = Math.sign(Math.sin(2 * Math.PI * freq * t)) * env * 0.2;
    }
    return samples;
}

function generateError() {
    const duration = 0.2;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 150 - (50 * t / 0.2);
        const env = Math.exp(-t * 10);
        // Sawtooth
        const val = 2 * (t * freq - Math.floor(0.5 + t * freq));
        samples[i] = val * env * 0.2;
    }
    return samples;
}

function generateGainCoin() {
    const duration = 0.2;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 1200 + (200 * t / 0.2);
        const env = Math.exp(-t * 15);
        samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
    }
    return samples;
}

function generateShuffle() {
    const duration = 0.3;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    let lastOut = 0;
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 15);
        // Lowpass noise
        const white = Math.random() * 2 - 1;
        lastOut = lastOut + 0.1 * (white - lastOut);
        samples[i] = lastOut * env * 0.8;
    }
    return samples;
}

const outDir = path.join(__dirname, '..', 'src', 'asset', 'audio');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

writeWav(path.join(outDir, 'playCard.wav'), generatePlayCard());
writeWav(path.join(outDir, 'buyCard.wav'), generateBuyCard());
writeWav(path.join(outDir, 'error.wav'), generateError());
writeWav(path.join(outDir, 'gainCoin.wav'), generateGainCoin());
writeWav(path.join(outDir, 'shuffle.wav'), generateShuffle());

console.log("SFX Generation Complete!");
