import { useEffect, useRef, useState } from 'react';

type Phase = 'in' | 'hold' | 'out';
const SEQUENCE: { phase: Phase; label: string; seconds: number }[] = [
  { phase: 'in', label: 'Breathe in', seconds: 4 },
  { phase: 'hold', label: 'Hold', seconds: 4 },
  { phase: 'out', label: 'Breathe out', seconds: 6 },
];

export default function BreathingExercise() {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [count, setCount] = useState(SEQUENCE[0].seconds);
  const [cycles, setCycles] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setCount((c) => {
        if (c > 1) return c - 1;
        setStep((s) => {
          const next = (s + 1) % SEQUENCE.length;
          if (next === 0) setCycles((cy) => cy + 1);
          setCount(SEQUENCE[next].seconds);
          return next;
        });
        return SEQUENCE[step].seconds;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running, step]);

  const current = SEQUENCE[step];
  const scale = current.phase === 'in' ? 1 : current.phase === 'hold' ? 1 : 0.55;

  const reset = () => {
    setRunning(false);
    setStep(0);
    setCount(SEQUENCE[0].seconds);
    setCycles(0);
  };

  return (
    <div className="card p-6 flex flex-col items-center text-center">
      <h3 className="font-bold text-neutral-900 mb-1">Breathing Exercise</h3>
      <p className="text-sm text-neutral-500 mb-6">Box-style 4-4-6 breathing to calm your nervous system.</p>

      <div className="relative w-48 h-48 flex items-center justify-center mb-6">
        <div
          className="absolute rounded-full bg-primary-100"
          style={{
            width: '100%',
            height: '100%',
            transform: `scale(${running ? scale : 0.7})`,
            transition: `transform ${current.seconds}s ease-in-out`,
          }}
        />
        <div
          className="absolute rounded-full border-4 border-primary-500/40"
          style={{
            width: '78%',
            height: '78%',
            transform: `scale(${running ? scale : 0.7})`,
            transition: `transform ${current.seconds}s ease-in-out`,
          }}
        />
        <div className="relative z-10">
          <div className="text-lg font-bold text-primary-800">{running ? current.label : 'Ready?'}</div>
          {running && <div className="text-3xl font-bold text-primary-700 tabular-nums">{count}</div>}
        </div>
      </div>

      {cycles > 0 && <p className="text-xs text-neutral-400 mb-3">Completed cycles: {cycles}</p>}

      <div className="flex gap-2">
        {!running ? (
          <button onClick={() => setRunning(true)} className="btn-primary">
            Start
          </button>
        ) : (
          <button onClick={() => setRunning(false)} className="btn-outline">
            Pause
          </button>
        )}
        <button onClick={reset} className="btn-ghost">
          Reset
        </button>
      </div>
    </div>
  );
}
