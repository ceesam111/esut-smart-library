import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MemoryGame from './MemoryGame';
import WordPuzzle from './WordPuzzle';
import FocusTrail from './FocusTrail';
import SudokuLite from './SudokuLite';
import AmbientSounds from './AmbientSounds';

type GameKey = 'memory' | 'word' | 'colour' | 'sudoku' | 'sounds';

const GAMES: { key: GameKey; label: string; icon: string }[] = [
  { key: 'memory', label: 'Memory Cards', icon: '🃏' },
  { key: 'word', label: 'Word Puzzle', icon: '🔤' },
  { key: 'colour', label: 'Focus Trail', icon: '🎯' },
  { key: 'sudoku', label: 'Sudoku-Lite', icon: '🔢' },
  { key: 'sounds', label: 'Ambient Sounds', icon: '🔊' },
];

const BREAK_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

export default function GamesHub({ onReturn }: { onReturn?: () => void }) {
  const [active, setActive] = useState<GameKey>('memory');
  const [showPrompt, setShowPrompt] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const t = setTimeout(() => setShowPrompt(true), BREAK_LIMIT_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-thin">
        {GAMES.map((g) => (
          <button
            key={g.key}
            onClick={() => setActive(g.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              active === g.key
                ? 'bg-primary-700 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            <span className="mr-1.5">{g.icon}</span>
            {g.label}
          </button>
        ))}
      </div>

      <div className="card p-6 min-h-[360px]">
        {active === 'memory' && <MemoryGame />}
        {active === 'word' && <WordPuzzle />}
        {active === 'colour' && <FocusTrail />}
        {active === 'sudoku' && <SudokuLite />}
        {active === 'sounds' && <AmbientSounds />}
      </div>

      {onReturn && (
        <div className="mt-5 text-center">
          <button onClick={onReturn} className="btn-outline">
            ← Return to Reading
          </button>
        </div>
      )}

      {/* 15-minute gentle prompt */}
      {showPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full text-center shadow-xl">
            <div className="text-4xl mb-3">☕</div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Ready to return to your studies?</h3>
            <p className="text-sm text-neutral-500 mb-6">
              You’ve taken a good 15-minute break. A refreshed mind learns better — but stay as long as you need.
            </p>
            <div className="flex flex-col gap-2">
              <Link to="/catalogue" className="btn-primary w-full">
                Back to the catalogue
              </Link>
              {onReturn && (
                <button onClick={onReturn} className="btn-outline w-full">
                  Return to Reading
                </button>
              )}
              <button onClick={() => setShowPrompt(false)} className="btn-ghost w-full">
                Keep playing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
