const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const audioDir = path.join(__dirname, '..', 'src', 'asset', 'audio');
const keepWav = process.argv.includes('--keep-wav');

if (!fs.existsSync(audioDir)) {
    console.error(`Audio directory not found: ${audioDir}`);
    process.exit(1);
}

function hasFfmpeg() {
    const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return res.status === 0;
}

if (!hasFfmpeg()) {
    console.error('ffmpeg is required to encode ogg files.');
    process.exit(1);
}

const wavFiles = fs.readdirSync(audioDir).filter((f) => f.toLowerCase().endsWith('.wav'));
if (wavFiles.length === 0) {
    console.log('No wav files found.');
    process.exit(0);
}

let converted = 0;
for (const wav of wavFiles) {
    const inPath = path.join(audioDir, wav);
    const outPath = path.join(audioDir, wav.replace(/\.wav$/i, '.ogg'));

    // -q:a 5 gives transparent quality for game SFX/BGM at much smaller size than wav.
    const res = spawnSync(
        'ffmpeg',
        ['-y', '-i', inPath, '-vn', '-c:a', 'libvorbis', '-q:a', '5', outPath],
        { stdio: 'inherit' }
    );

    if (res.status !== 0) {
        console.error(`Failed to encode: ${wav}`);
        process.exit(1);
    }

    converted += 1;
    console.log(`Encoded: ${path.basename(outPath)}`);
}

if (!keepWav) {
    for (const wav of wavFiles) {
        fs.unlinkSync(path.join(audioDir, wav));
    }
    console.log(`Deleted ${wavFiles.length} wav file(s).`);
}

console.log(`OGG encoding complete. Converted ${converted} file(s).`);
