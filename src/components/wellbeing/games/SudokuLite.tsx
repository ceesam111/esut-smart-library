import { useMemo, useState } from 'react';

// 4x4 Sudoku: each row, column and 2x2 box contains 1–4.
const SOLUTIONS = [
  [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
  [2, 4, 1, 3, 1, 3, 2, 4, 4, 2, 3, 1, 3, 1, 4, 2],
  [4, 3, 2, 1, 2, 1, 4, 3, 1, 2, 3, 4, 3, 4, 1, 2],
  [3, 1, 4, 2, 4, 2, 3, 1, 2, 4, 1, 3, 1, 3, 2, 4],
];

function makePuzzle() {
  const sol = SOLUTIONS[Math.floor(Math.random() * SOLUTIONS.length)];
  const holes = new Set<number>();
  while (holes.size < 8) holes.add(Math.floor(Math.random() * 16));
  const given = sol.map((v, i) => (holes.has(i) ? 0 : v));
  return { sol, given };
}

export default function SudokuLite() {
  const [{ sol, given }, setPuzzle] = useState(makePuzzle);
  const [cells, setCells] = useState<number[]>(given);
  const [selected, setSelected] = useState<number | null>(null);
  const [key, setKey] = useState(0);

  const complete = useMemo(
    () => cells.every((v, i) => v === sol[i]),
    [cells, sol],
  );

  const setVal = (val: number) => {
    if (selected === null || given[selected] !== 0) return;
    setCells((prev) => prev.map((v, i) => (i === selected ? val : v)));
  };

  const reset = () => {
    const p = makePuzzle();
    setPuzzle(p);
    setCells(p.given);
    setSelected(null);
    setKey((k) => k + 1);
  };

  return (
    <div key={key} className="max-w-xs mx-auto text-center">
      <div className="mb-4 rounded-xl bg-primary-50 border border-primary-100 p-4 text-left text-sm text-primary-900">
        <strong>How to play:</strong> fill each row, column, and 2x2 box with numbers 1 to 4. Tap an empty square, then tap a number.
      </div>
      {complete && (
        <div className="mb-4 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg py-2">
          🎉 Solved! Nicely done.
        </div>
      )}
      <div className="grid grid-cols-4 gap-1 bg-neutral-300 p-1 rounded-lg mb-4">
        {cells.map((v, i) => {
          const fixed = given[i] !== 0;
          const wrong = v !== 0 && v !== sol[i];
          const boxShade = (Math.floor(i / 4) < 2) === (i % 4 < 2);
          return (
            <button
              key={i}
              onClick={() => !fixed && setSelected(i)}
              className={`aspect-square text-lg font-bold rounded flex items-center justify-center transition-colors ${
                boxShade ? 'bg-white' : 'bg-neutral-50'
              } ${selected === i ? 'ring-2 ring-primary-500' : ''} ${
                fixed ? 'text-neutral-900' : wrong ? 'text-error-700' : 'text-primary-700'
              }`}
            >
              {v !== 0 ? v : ''}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 justify-center mb-3">
        {[1, 2, 3, 4].map((n) => (
          <button key={n} onClick={() => setVal(n)} className="btn-outline w-11 !px-0 !py-2">
            {n}
          </button>
        ))}
        <button onClick={() => setVal(0)} className="btn-ghost !px-3 !py-2">✕</button>
      </div>
      <button onClick={reset} className="btn-ghost text-sm">New puzzle</button>
    </div>
  );
}
