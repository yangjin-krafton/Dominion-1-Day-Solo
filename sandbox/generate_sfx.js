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
// All Metal Strike Variants
// ---------------------------------------------------------

function generatePlayCard() {
    // 얇은 금속 판을 가볍게 톡 — thin metal flick
    // 고주파, 매우 짧은 잔향
    const duration = 0.22;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 32);
        // 얇은 판 금속 비화음 배음 (inharmonic partials)
        const v1 = Math.sin(2 * Math.PI * 1760 * t) * 0.35;
        const v2 = Math.sin(2 * Math.PI * 3090 * t) * 0.25;
        const v3 = Math.sin(2 * Math.PI * 5250 * t) * 0.15;
        const v4 = Math.sin(2 * Math.PI * 7800 * t) * 0.08;
        // 타격 트랜지언트
        const atk = (Math.random() * 2 - 1) * Math.exp(-t * 180) * 0.45;
        samples[i] = (v1 + v2 + v3 + v4 + atk) * env * 0.68;
    }
    return samples;
}

function generateBuyCard() {
    // 작은 종 딩 — small shop bell ding (구매 확인)
    // 중주파, 밝고 청명한 잔향
    const duration = 0.70;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    // 벨 배음비 (bell partial ratios from physical modeling)
    const partials = [
        { f: 780,  a: 0.30, d: 5.5 },  // fundamental
        { f: 1248, a: 0.20, d: 7.0 },  // ~1.6f (hum)
        { f: 2028, a: 0.18, d: 8.0 },  // ~2.6f (prime)
        { f: 3198, a: 0.12, d: 9.0 },  // ~4.1f (tierce)
        { f: 4680, a: 0.08, d: 11.0 }, // ~6.0f (quint)
    ];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        let s = 0;
        for (const p of partials) {
            s += Math.sin(2 * Math.PI * p.f * t) * p.a * Math.exp(-t * p.d);
        }
        // 타격 임팩트
        const atk = (Math.random() * 2 - 1) * Math.exp(-t * 200) * 0.30;
        samples[i] = (s + atk) * 0.75;
    }
    return samples;
}

function generateError() {
    // 거친 금속 충돌음 — harsh dissonant clang (오류/거부)
    // 두 가깝지만 불협화한 금속 판이 부딪히는 소리
    const duration = 0.35;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 14);
        // 불협화 비화음 배음 쌍 — 맥놀이(beating) 발생
        const v1 = Math.sin(2 * Math.PI * 310 * t) * 0.28;
        const v2 = Math.sin(2 * Math.PI * 332 * t) * 0.28; // 22Hz 맥놀이
        const v3 = Math.sin(2 * Math.PI * 874 * t) * 0.18;
        const v4 = Math.sin(2 * Math.PI * 935 * t) * 0.18; // 61Hz 맥놀이
        const v5 = Math.sin(2 * Math.PI * 1680 * t) * 0.09;
        // 타격 노이즈 (금속 파편)
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.35;
        samples[i] = (v1 + v2 + v3 + v4 + v5 + noise) * env * 0.58;
    }
    return samples;
}

function generateGainCoin() {
    // 동전 클링크 — coins striking (기존 유지 + 개선)
    // 여러 동전이 잇달아 떨어지는 소리
    const duration = 0.55;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    // 3개의 동전 타격, 약간씩 시차
    const strikes = [
        { t0: 0.000, f1: 2240, f2: 2890, f3: 4150, f4: 5500 },
        { t0: 0.055, f1: 2560, f2: 3310, f3: 4750, f4: 6200 },
        { t0: 0.105, f1: 2040, f2: 2650, f3: 3890, f4: 5100 },
    ];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        let s = 0;
        for (const sk of strikes) {
            if (t < sk.t0) continue;
            const lt  = t - sk.t0;
            const env = Math.exp(-lt * 9);
            s += (Math.sin(2 * Math.PI * sk.f1 * lt) * 0.22
                + Math.sin(2 * Math.PI * sk.f2 * lt) * 0.17
                + Math.sin(2 * Math.PI * sk.f3 * lt) * 0.14
                + Math.sin(2 * Math.PI * sk.f4 * lt) * 0.10
                + (Math.random() * 2 - 1) * Math.exp(-lt * 120) * 0.35
                ) * env;
        }
        samples[i] = s * 0.60;
    }
    return samples;
}

function generateShuffle() {
    // 금속 구슬 폭포 — cascade of small metal beads
    // 빠른 연속 미세 타격으로 카드 셔플 감각 표현
    const duration = 0.65;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    // 12개의 미세 타격 스케줄
    const hits = [];
    for (let k = 0; k < 12; k++) {
        hits.push({
            t0: k * 0.048 + Math.random() * 0.012,
            freq: 3200 + Math.random() * 2400,
            amp:  0.55 + Math.random() * 0.45,
        });
    }
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        let s = 0;
        const globalEnv = Math.exp(-t * 5);
        for (const h of hits) {
            if (t < h.t0) continue;
            const lt  = t - h.t0;
            const env = Math.exp(-lt * 55) * h.amp;
            s += Math.sin(2 * Math.PI * h.freq * lt) * env * 0.18;
            s += Math.sin(2 * Math.PI * h.freq * 1.73 * lt) * env * 0.10;
            s += (Math.random() * 2 - 1) * Math.exp(-lt * 300) * 0.08;
        }
        samples[i] = s * globalEnv * 0.80;
    }
    return samples;
}

function generateGainAction() {
    // 검/칼날 울림 — sword/blade ring (액션 획득)
    // 고주파, 날카로운 어택, 중간 잔향
    const duration = 0.55;
    const samples  = new Float32Array(SAMPLE_RATE * duration);
    // 강철 칼날 배음 (steel blade partials)
    const partials = [
        { f: 1320, a: 0.32, d: 6.0  },
        { f: 2290, a: 0.24, d: 7.5  },
        { f: 3740, a: 0.18, d: 9.0  },
        { f: 5870, a: 0.12, d: 11.5 },
        { f: 8940, a: 0.07, d: 14.0 },
    ];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        let s = 0;
        for (const p of partials) {
            s += Math.sin(2 * Math.PI * p.f * t) * p.a * Math.exp(-t * p.d);
        }
        // 날카로운 타격 순간 — sharp metallic impact
        const atk = (Math.random() * 2 - 1) * Math.exp(-t * 250) * 0.40;
        // 고역대 긁힘 노이즈 (blade scrape)
        const scrape = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.10;
        samples[i] = (s + atk + scrape) * 0.65;
    }
    return samples;
}

function generateDrawCard() {
    // 가벼운 금속 스와이프 — light metallic card slide (드로우)
    // playCard보다 훨씬 부드럽고 공기감 있는 얇은 금속 스침 소리
    const duration = 0.18;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        // 초반 빠른 감쇠, 후반 잔잔한 shimmer
        const env = Math.exp(-t * 22) + Math.exp(-t * 6) * 0.18;
        // 아주 고주파의 얇은 금속 배음
        const v1 = Math.sin(2 * Math.PI * 3400 * t) * 0.28;
        const v2 = Math.sin(2 * Math.PI * 5900 * t) * 0.18;
        const v3 = Math.sin(2 * Math.PI * 9100 * t) * 0.10;
        // 슬라이드 느낌의 가벼운 노이즈 레이어
        const slide = (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.28;
        const shimmer = (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.08;
        samples[i] = (v1 + v2 + v3 + slide + shimmer) * env * 0.60;
    }
    return samples;
}

function generateEndTurn() {
    // 중간 무게 금속 종 타격 — medium metal bell toll (턴 종료)
    // buyCard 벨보다 무겁고 명료한 '마무리' 느낌의 단타
    const duration = 0.80;
    const samples = new Float32Array(SAMPLE_RATE * duration);
    // 중간 크기 쇠종 배음 (튜닝된 핸드벨)
    const partials = [
        { f: 560,  a: 0.32, d: 3.5 },   // fundamental
        { f: 920,  a: 0.22, d: 4.8 },   // ~1.64f
        { f: 1560, a: 0.17, d: 6.2 },   // ~2.79f
        { f: 2360, a: 0.11, d: 8.0 },   // ~4.21f
        { f: 3640, a: 0.07, d: 10.5 },
    ];
    for (let i = 0; i < samples.length; i++) {
        const t = i / SAMPLE_RATE;
        let s = 0;
        for (const p of partials) {
            s += Math.sin(2 * Math.PI * p.f * t) * p.a * Math.exp(-t * p.d);
        }
        // 타격 순간 금속 임팩트
        const atk = (Math.random() * 2 - 1) * Math.exp(-t * 220) * 0.32;
        samples[i] = (s + atk) * 0.72;
    }
    return samples;
}

// ---------------------------------------------------------
// File generation (MP3 only)
// ---------------------------------------------------------
const outDir = path.join(__dirname, '..', 'src', 'asset', 'audio');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sfxNames = ['playCard', 'buyCard', 'error', 'gainCoin', 'shuffle', 'gainAction', 'drawCard', 'endTurn'];
fs.readdirSync(outDir)
    .filter(f => sfxNames.some(n => f.startsWith(n)) && (f.endsWith('.ogg') || f.endsWith('.wav')))
    .forEach(f => { fs.unlinkSync(path.join(outDir, f)); console.log(`  deleted ${f}`); });

writeMp3(outDir, 'playCard',    generatePlayCard());
writeMp3(outDir, 'buyCard',     generateBuyCard());
writeMp3(outDir, 'error',       generateError());
writeMp3(outDir, 'gainCoin',    generateGainCoin());
writeMp3(outDir, 'shuffle',     generateShuffle());
writeMp3(outDir, 'gainAction',  generateGainAction());
writeMp3(outDir, 'drawCard',    generateDrawCard());
writeMp3(outDir, 'endTurn',     generateEndTurn());

console.log('SFX Generation Complete — 10 × MP3 (All Metal Strikes)');
