import { useEffect, useRef, useState } from 'react';

type SoundKey = 'rain' | 'forest' | 'library' | 'birds' | 'ocean' | 'flute' | 'piano' | 'guitar' | 'drums' | 'crickets' | 'cats' | 'whales';

const SOUNDS: { key: SoundKey; label: string; icon: string; desc: string }[] = [
  { key: 'rain', label: 'Rain', icon: '🌧️', desc: 'Steady rainfall' },
  { key: 'forest', label: 'Forest', icon: '🌲', desc: 'Wind through trees' },
  { key: 'library', label: 'Library', icon: '📖', desc: 'Soft quiet hum' },
  { key: 'birds', label: 'Birds', icon: '🐦', desc: 'Gentle morning chirps' },
  { key: 'ocean', label: 'Ocean', icon: '🌊', desc: 'Slow wave rhythm' },
  { key: 'flute', label: 'Flute', icon: '🪈', desc: 'Soft breath melody' },
  { key: 'piano', label: 'Piano', icon: '🎹', desc: 'Warm simple tones' },
  { key: 'guitar', label: 'Guitar', icon: '🎸', desc: 'Quiet plucked strings' },
  { key: 'drums', label: 'Drums', icon: '🥁', desc: 'Slow grounding pulse' },
  { key: 'crickets', label: 'Crickets', icon: '🦗', desc: 'Night field ambience' },
  { key: 'cats', label: 'Cat Purr', icon: '🐈', desc: 'Low comforting purr' },
  { key: 'whales', label: 'Whales', icon: '🐋', desc: 'Deep ocean calls' },
];

const SOUND_PROFILES: Record<SoundKey, { noise: 'white' | 'pink' | 'brown'; filter: BiquadFilterType; frequency: number; gain: number }> = {
  rain: { noise: 'pink', filter: 'highpass', frequency: 900, gain: 0.75 },
  forest: { noise: 'pink', filter: 'lowpass', frequency: 420, gain: 0.45 },
  library: { noise: 'brown', filter: 'lowpass', frequency: 180, gain: 0.35 },
  birds: { noise: 'pink', filter: 'bandpass', frequency: 1500, gain: 0.35 },
  ocean: { noise: 'brown', filter: 'lowpass', frequency: 320, gain: 0.65 },
  flute: { noise: 'white', filter: 'bandpass', frequency: 850, gain: 0.18 },
  piano: { noise: 'white', filter: 'bandpass', frequency: 440, gain: 0.16 },
  guitar: { noise: 'white', filter: 'bandpass', frequency: 260, gain: 0.16 },
  drums: { noise: 'brown', filter: 'lowpass', frequency: 110, gain: 0.28 },
  crickets: { noise: 'white', filter: 'bandpass', frequency: 2400, gain: 0.22 },
  cats: { noise: 'brown', filter: 'lowpass', frequency: 120, gain: 0.32 },
  whales: { noise: 'brown', filter: 'lowpass', frequency: 220, gain: 0.4 },
};

// Generates a few seconds of noise into an AudioBuffer.
function makeNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown') {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') data[i] = white;
    else if (type === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      // pink
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.25;
    }
  }
  return buffer;
}

export default function AmbientSounds() {
  const [playing, setPlaying] = useState<SoundKey | null>(null);
  const [volume, setVolume] = useState(0.5);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const extraCleanupRef = useRef<(() => void) | null>(null);

  const stop = () => {
    if (srcRef.current) {
      try { srcRef.current.stop(); } catch { /* noop */ }
      srcRef.current.disconnect();
      srcRef.current = null;
    }
    extraCleanupRef.current?.();
    extraCleanupRef.current = null;
    setPlaying(null);
  };

  const play = (key: SoundKey) => {
    if (playing === key) return stop();
    stop();
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;
    }
    ctx.resume();

    const profile = SOUND_PROFILES[key];
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, profile.noise);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = profile.filter;
    filter.frequency.value = profile.frequency;

    const gain = ctx.createGain();
    gain.gain.value = volume * profile.gain;
    gainRef.current = gain;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    if (['birds', 'ocean', 'flute', 'piano', 'guitar', 'drums', 'crickets', 'cats', 'whales'].includes(key)) extraCleanupRef.current = addPulse(ctx, gain, key);
    srcRef.current = src;
    setPlaying(key);
  };

  useEffect(() => {
    if (gainRef.current && playing) gainRef.current.gain.value = volume * SOUND_PROFILES[playing].gain;
  }, [volume, playing]);

  useEffect(() => () => { stop(); ctxRef.current?.close(); }, []); // eslint-disable-line

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-4 rounded-xl bg-primary-50 border border-primary-100 p-4 text-sm text-primary-900">
        <strong>How to use:</strong> choose one sound, keep the volume low, breathe slowly, and stop it before returning to study.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {SOUNDS.map((s) => (
          <button
            key={s.key}
            onClick={() => play(s.key)}
            className={`rounded-xl p-4 border-2 transition-all text-center ${
              playing === s.key
                ? 'border-primary-600 bg-primary-50'
                : 'border-neutral-200 hover:border-primary-300 bg-white'
            }`}
          >
            <div className="text-3xl mb-1">{s.icon}</div>
            <div className="text-sm font-semibold text-neutral-800">{s.label}</div>
            <div className="text-xs text-neutral-400">{s.desc}</div>
            {playing === s.key && <div className="text-xs text-primary-600 font-medium mt-1">▶ Playing</div>}
          </button>
        ))}
      </div>

      <label className="label">Volume</label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-full accent-primary-700"
      />

      {playing && (
        <button onClick={stop} className="btn-outline w-full mt-5">
          Stop sound
        </button>
      )}
      <p className="text-xs text-neutral-400 mt-4 text-center">
        Sounds are gently synthesised in your browser — no download needed.
      </p>
    </div>
  );
}

function addPulse(ctx: AudioContext, gain: GainNode, key: SoundKey) {
  const osc = ctx.createOscillator();
  const pulseGain = ctx.createGain();
  const frequencies: Partial<Record<SoundKey, number>> = { birds: 1600, ocean: 90, flute: 660, piano: 392, guitar: 247, drums: 70, crickets: 2800, cats: 55, whales: 120 };
  const intervals: Partial<Record<SoundKey, number>> = { birds: 850, ocean: 3200, flute: 2400, piano: 2600, guitar: 1800, drums: 1100, crickets: 650, cats: 140, whales: 4200 };
  osc.type = key === 'drums' || key === 'cats' || key === 'whales' || key === 'ocean' ? 'sine' : 'triangle';
  osc.frequency.value = frequencies[key] ?? 440;
  pulseGain.gain.value = key === 'cats' ? 0.018 : key === 'drums' ? 0.08 : 0.025;
  osc.connect(pulseGain);
  pulseGain.connect(gain);
  osc.start();
  const interval = window.setInterval(() => {
    const now = ctx.currentTime;
    pulseGain.gain.cancelScheduledValues(now);
    pulseGain.gain.setValueAtTime(0.005, now);
    pulseGain.gain.linearRampToValueAtTime(key === 'drums' ? 0.12 : key === 'whales' || key === 'ocean' ? 0.04 : 0.05, now + 0.08);
    pulseGain.gain.linearRampToValueAtTime(0.005, now + (key === 'drums' ? 0.35 : key === 'cats' ? 0.12 : key === 'whales' || key === 'ocean' ? 2.2 : 0.75));
  }, intervals[key] ?? 1800);
  return () => {
    window.clearInterval(interval);
    try { osc.stop(); } catch { /* noop */ }
    osc.disconnect();
    pulseGain.disconnect();
  };
}
