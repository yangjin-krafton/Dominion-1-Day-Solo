// sfx.js
// Plays the generated .wav audio files

const audioCache = {};

function playSound(name) {
    if (!audioCache[name]) {
        audioCache[name] = new Audio(`./asset/audio/${name}.wav`);
    }
    // clone to allow overlapping sounds
    const sound = audioCache[name].cloneNode();
    sound.volume = 0.5;
    sound.play().catch(e => console.error("Audio play blocked", e));
}

export const SFX = {
    playCard: () => playSound('playCard'),
    buyCard: () => playSound('buyCard'),
    error: () => playSound('error'),
    gainCoin: () => playSound('gainCoin'),
    shuffle: () => playSound('shuffle')
};
