import { useEffect, useState } from 'react';

const COLOURS = [
  { name: 'Red', hex: '#dc2626' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Gold', hex: '#C9A84C' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Pink', hex: '#db2777' },
];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function ColourMatch() {
  const [target, setTarget] = useState(() => pick(COLOURS));
  const [options, setOptions] = useState<typeof COLOURS>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'right' | 'wrong'>('idle');

  const newRound = () => {
    const t = pick(COLOURS);
    const distractors = COLOURS.filter((c) => c.name !== t.name).sort(() => Math.random() - 0.5).slice(0, 3);
    const opts = [t, ...distractors].sort(() => Math.random() - 0.5);
    setTarget(t);
    setOptions(opts);
    setFeedback('idle');
  };

  useEffect(() => {
    newRound();
  }, []);

  const choose = (name: string) => {
    if (name === target.name) {
      setFeedback('right');
      setScore((s) => {
        const ns = s + 1;
        setBest((b) => Math.max(b, ns));
        return ns;
      });
      setTimeout(newRound, 350);
    } else {
      setFeedback('wrong');
      setScore(0);
      setTimeout(newRound, 700);
    }
  };

  return (
    <div className="max-w-md mx-auto text-center">
      <div className="flex justify-between text-sm text-neutral-500 mb-5">
        <span>Streak: <span className="font-semibold text-neutral-800">{score}</span></span>
        <span>Best: <span className="font-semibold text-neutral-800">{best}</span></span>
      </div>

      <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">Tap the colour named</p>
      <div className="text-3xl font-bold mb-6" style={{ color: feedback === 'wrong' ? '#dc2626' : '#6B1D2A' }}>
        {target.name}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((c) => (
          <button
            key={c.name}
            onClick={() => choose(c.name)}
            className="h-20 rounded-xl shadow-sm active:scale-95 transition-transform"
            style={{ background: c.hex }}
            aria-label={c.name}
          />
        ))}
      </div>
      {feedback === 'wrong' && <p className="text-error-700 text-sm mt-4">Oops! Streak reset.</p>}
    </div>
  );
}
