// Synthesised SFX — no asset files. The AudioContext is built on first play so we
// never trip the autoplay policy before the player has touched the page, and every
// entry point is failure-tolerant: audio going missing must never break the table.

type Sting = 'pung' | 'gong' | 'win';

const STORAGE_KEY = 'mahjong.muted';

const NOTES: Record<Sting, number[]> = {
  pung: [523.25, 659.25], // C5 E5
  gong: [392.0, 523.25, 784.0], // G4 C5 G5
  win: [523.25, 783.99, 1046.5], // C5 G5 C6
};

let ctx: AudioContext | null = null;
let mutedCache: boolean | null = null;

function isMuted(): boolean {
  if (mutedCache === null) {
    try {
      mutedCache = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      mutedCache = false;
    }
  }
  return mutedCache;
}

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export const sounds = {
  // A tile hitting the table: a very short noise burst squeezed into the clatter band.
  clack(): void {
    if (isMuted()) return;
    const ac = audio();
    if (!ac) return;
    const length = Math.floor(ac.sampleRate * 0.03);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const decay = (1 - i / length) ** 2;
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2100;
    filter.Q.value = 0.9;
    const gain = ac.createGain();
    gain.gain.value = 0.35;
    source.connect(filter).connect(gain).connect(ac.destination);
    source.start();
  },

  sting(kind: Sting): void {
    if (isMuted()) return;
    const ac = audio();
    if (!ac) return;
    const start = ac.currentTime;
    for (const [i, frequency] of NOTES[kind].entries()) {
      const at = start + i * 0.09;
      const osc = ac.createOscillator();
      osc.type = kind === 'gong' ? 'square' : 'triangle';
      osc.frequency.value = frequency;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(kind === 'gong' ? 0.13 : 0.2, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain).connect(ac.destination);
      osc.start(at);
      osc.stop(at + 0.25);
    }
  },

  get muted(): boolean {
    return isMuted();
  },

  toggle(): void {
    mutedCache = !isMuted();
    try {
      localStorage.setItem(STORAGE_KEY, mutedCache ? '1' : '0');
    } catch {
      // A blocked localStorage still mutes for this session.
    }
  },
};
