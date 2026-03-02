// audioFormat.js
// Choose compressed audio first to reduce transfer size.

let cachedExt = null;

function pickExt() {
    if (cachedExt) return cachedExt;

    const probe = document.createElement('audio');
    const canPlay = (mime) => {
        const r = probe.canPlayType(mime);
        return r === 'probably' || r === 'maybe';
    };

    if (canPlay('audio/ogg; codecs="vorbis"')) {
        cachedExt = 'ogg';
    } else if (canPlay('audio/mpeg')) {
        cachedExt = 'mp3';
    } else {
        cachedExt = 'wav';
    }

    return cachedExt;
}

export function audioPath(name) {
    return `./asset/audio/${name}.${pickExt()}`;
}

