// audioFormat.js
// All stems are encoded as MP3 (128 kbps) — universally supported on mobile.

export function audioPath(name) {
    return `./asset/audio/${name}.mp3`;
}
