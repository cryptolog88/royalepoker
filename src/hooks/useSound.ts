import { useCallback, useRef } from 'react';

// Sound URLs - using freesound.org previews
const SOUNDS = {
    fold: 'https://cdn.freesound.org/previews/240/240776_4107740-lq.mp3',
    check: 'https://cdn.freesound.org/previews/256/256116_3263906-lq.mp3',
    call: 'https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3',
    raise: 'https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3',
    chips: 'https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3',
    win: 'https://cdn.freesound.org/previews/270/270402_5123851-lq.mp3',
    deal: 'https://cdn.freesound.org/previews/240/240777_4107740-lq.mp3',
};

export type SoundType = keyof typeof SOUNDS;

export const useSound = (muted: boolean = false) => {
    const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

    const playSound = useCallback((type: SoundType) => {
        if (muted) return;

        try {
            let audio = audioCache.current.get(type);
            if (!audio) {
                audio = new Audio(SOUNDS[type]);
                audio.volume = 0.5;
                audioCache.current.set(type, audio);
            }
            audio.currentTime = 0;
            audio.play().catch(() => { });
        } catch {
            // Ignore sound errors
        }
    }, [muted]);

    return { playSound };
};
