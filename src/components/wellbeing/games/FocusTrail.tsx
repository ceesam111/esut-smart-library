import { useEffect, useState } from 'react';

const DOTS = Array.from({ length: 9 }, (_, i) => i + 1);

function shuffledDots() {
  return DOTS.map((value) => ({ value, top: 15 + Math.random() * 65, left: 10 + Math.random() * 75 }));
}

export default function FocusTrail() {
  const [dots, setDots] = useState(shuffledDots);
  const [next, setNext] = useState(1);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [doneTime, setDoneTime] = useState<number | null>(null);

  const restart = () => {
    setDots(shuffledDots());
    setNext(1);
    setStartedAt(null);
    setDoneTime(null);
  };

  const tap = (value: number) => {
    if (value !== next) return;
    const start = startedAt ?? Date.now();
    setStartedAt(start);
    if (value === DOTS.length) {
      const seconds = Math.max(1, Math.round((Date.now() - start) / 1000));
      setDoneTime(seconds);
      setBest((prev) => prev === null ? seconds : Math.min(prev, seconds));
    }
    setNext(value + 1);
  };

  useEffect(() => {
    if (doneTime) return;
    const timer = setInterval(() => setDots((prev) => [...prev]), 1000);
    return () => clearInterval(timer);
  }, [doneTime]);

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-4 rounded-xl bg-primary-50 border border-primary-100 p-4 text-sm text-primary-900">
        <strong>How to play:</strong> tap the circles from 1 to 9 as quickly as you can. It trains focus, visual scanning, and calm attention.
      </div>
      <div className="flex items-center justify-between mb-4 text-sm text-neutral-500">
        <span>Next: <strong className="text-neutral-900">{next > 9 ? 'done' : next}</strong></span>
        <span>Best: <strong className="text-neutral-900">{best ? `${best}s` : '—'}</strong></span>
        <button onClick={restart} className="btn-ghost text-sm">New trail</button>
      </div>
      {doneTime && <div className="mb-4 text-center text-sm font-medium text-primary-700 bg-primary-50 rounded-lg py-2">Great focus. Completed in {doneTime}s.</div>}
      <div className="relative h-80 rounded-3xl bg-gradient-to-br from-emerald-50 via-amber-50 to-white border border-neutral-200 overflow-hidden">
        {dots.map((dot) => {
          const hit = dot.value < next;
          return (
            <button
              key={dot.value}
              onClick={() => tap(dot.value)}
              disabled={hit || !!doneTime}
              className={`absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full font-bold shadow-md transition-all ${hit ? 'bg-primary-200 text-primary-800 scale-75 opacity-50' : 'bg-primary-700 text-white hover:scale-110'}`}
              style={{ top: `${dot.top}%`, left: `${dot.left}%` }}
            >
              {dot.value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
