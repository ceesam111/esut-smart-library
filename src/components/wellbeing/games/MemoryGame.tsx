import { useEffect, useState } from 'react';

const EMOJIS = ['📚', '🦉', '🌿', '☕', '🎓', '🔬', '🎨', '🎵'];

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function shuffle(): Card[] {
  const pairs = [...EMOJIS, ...EMOJIS].map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

export default function MemoryGame() {
  const [cards, setCards] = useState<Card[]>(shuffle);
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const won = cards.every((c) => c.matched);

  useEffect(() => {
    if (picked.length !== 2) return;
    setLocked(true);
    const [a, b] = picked;
    const match = cards[a].emoji === cards[b].emoji;
    const t = setTimeout(() => {
      setCards((prev) =>
        prev.map((c, i) =>
          i === a || i === b ? { ...c, matched: match || c.matched, flipped: false } : c,
        ),
      );
      setPicked([]);
      setLocked(false);
    }, match ? 400 : 800);
    setMoves((m) => m + 1);
    return () => clearTimeout(t);
  }, [picked]); // eslint-disable-line

  const flip = (i: number) => {
    if (locked || cards[i].flipped || cards[i].matched || picked.length === 2) return;
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, flipped: true } : c)));
    setPicked((p) => [...p, i]);
  };

  const restart = () => {
    setCards(shuffle());
    setPicked([]);
    setMoves(0);
  };

  return (
    <div>
      <div className="mb-4 rounded-xl bg-primary-50 border border-primary-100 p-4 text-sm text-primary-900">
        <strong>How to play:</strong> turn over two cards at a time and remember their positions. Match all pairs in the fewest moves.
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">Moves: <span className="font-semibold text-neutral-800">{moves}</span></p>
        <button onClick={restart} className="btn-ghost text-sm">New game</button>
      </div>
      {won && (
        <div className="mb-4 text-center text-sm font-medium text-primary-700 bg-primary-50 rounded-lg py-2">
          🎉 Well done! Cleared in {moves} moves.
        </div>
      )}
      <div className="grid grid-cols-4 gap-2.5 max-w-sm mx-auto">
        {cards.map((c, i) => (
          <button
            key={c.id}
            onClick={() => flip(i)}
            className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-200 ${
              c.flipped || c.matched
                ? 'bg-primary-100 scale-100'
                : 'bg-primary-700 hover:bg-primary-800 text-transparent'
            } ${c.matched ? 'opacity-50' : ''}`}
          >
            {c.flipped || c.matched ? c.emoji : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}
