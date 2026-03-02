// bgm.js
// Generative Ambient BGM Manager
// Uses 9 stems (3 Pads, 3 Plucks, 3 Basses). Each category randomly crossfades 
// between its 3 variations and dynamically adjusts volume, creating infinite combinations.

const categories = {
    pad: {
        maxVol: 0.35,
        stems: [
            { name: 'bgm_pad1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_pad2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_pad3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    },
    pluck: {
        maxVol: 0.25,
        stems: [
            { name: 'bgm_pluck1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_pluck2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_pluck3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    },
    bass: {
        maxVol: 0.40,
        stems: [
            { name: 'bgm_bass1', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_bass2', audio: null, currentVol: 0, targetVol: 0 },
            { name: 'bgm_bass3', audio: null, currentVol: 0, targetVol: 0 }
        ]
    }
};

let initialized = false;
let randomizationInterval = null;
let interpolationInterval = null;

export const BGM = {
    start: () => {
        if (initialized) return;
        initialized = true;
        
        let canPlayPromises = [];

        // 1. Load and play all 9 stems at 0 volume
        Object.values(categories).forEach(cat => {
            cat.stems.forEach(stem => {
                const a = new Audio(`./asset/audio/${stem.name}.wav`);
                a.loop = true;
                a.volume = 0;
                stem.audio = a;
                // Trigger play immediately, catch user gesture policy
                let p = a.play().catch(e => {
                     console.warn(`BGM start blocked for ${stem.name} - waiting for interaction.`, e);
                     return false; 
                });
                canPlayPromises.push(p);
            });
        });

        // Helper: pick a random target volume strategy for a category
        const refreshCategory = (cat) => {
            // 20% chance the entire category goes silent
            if (Math.random() < 0.2) {
                cat.stems.forEach(s => s.targetVol = 0);
            } else {
                // Select ONE variation to become active
                const activeIndex = Math.floor(Math.random() * cat.stems.length);
                const activeVol = cat.maxVol * (0.5 + Math.random() * 0.5); // 50~100% of max

                cat.stems.forEach((s, idx) => {
                    s.targetVol = (idx === activeIndex) ? activeVol : 0;
                });
            }
        };

        // Initial setup
        Object.values(categories).forEach(refreshCategory);

        // 2. Change arrangements smoothly every 8 seconds
        randomizationInterval = setInterval(() => {
            Object.values(categories).forEach(refreshCategory);
        }, 8000);

        // 3. Smooth volume interpolation (60 fps)
        interpolationInterval = setInterval(() => {
            Object.values(categories).forEach(cat => {
                cat.stems.forEach(stem => {
                    if (stem.audio) {
                        // Slow, dreamy crossfade (1% step per frame ~ 1.5 seconds to fade)
                        stem.currentVol += (stem.targetVol - stem.currentVol) * 0.01;
                        
                        // Prevent precision floating point bounds issues
                        const clampedVol = Math.max(0, Math.min(1, stem.currentVol));
                        
                        // Slight check to reduce audio API overhead if already silent
                        if (Math.abs(stem.audio.volume - clampedVol) > 0.001) {
                            stem.audio.volume = clampedVol;
                        }
                    }
                });
            });
        }, 1000 / 60);
    },

    stop: () => {
        Object.values(categories).forEach(cat => {
            cat.stems.forEach(stem => {
                if (stem.audio) stem.audio.pause();
                stem.targetVol = 0;
            });
        });
        if (randomizationInterval) clearInterval(randomizationInterval);
        if (interpolationInterval) clearInterval(interpolationInterval);
        initialized = false;
    }
};
