import { useMemo, useState } from 'react';

const WORDS = [
  { word: 'LIBRARY', hint: 'A place full of books' },
  { word: 'KNOWLEDGE', hint: 'What you gain from study' },
  { word: 'RESEARCH', hint: 'Careful investigation' },
  { word: 'CATALOGUE', hint: 'A searchable list of items' },
  { word: 'CITATION', hint: 'A reference to a source' },
  { word: 'JOURNAL', hint: 'A scholarly periodical' },
  { word: 'ARCHIVE', hint: 'A store of records' },
  { word: 'WISDOM', hint: 'Deep understanding' },
  { word: 'STUDENT', hint: 'A person who learns' },
  { word: 'CAMPUS', hint: 'University grounds' },
];

function scramble(word: string) {
  const letters = word.split('');
  let out = word;
  let guard = 0;
  while (out === word && guard++ < 20) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    out = letters.join('');
  }
  return out;
}

export default function WordPuzzle() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * WORDS.length));
  const current = WORDS[index];
  const scrambled = useMemo(() => scramble(current.word), [index]);
  const [guess, setGuess] = useState('');
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [solved, setSolved] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const check = () => {
    if (guess.trim().toUpperCase() === current.word) {
      setStatus('correct');
      setSolved((s) => s + 1);
    } else {
      setStatus('wrong');
    }
  };

  const next = () => {
    setIndex(Math.floor(Math.random() * WORDS.length));
    setGuess('');
    setStatus('idle');
    setShowHint(false);
  };

  return (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-4 rounded-xl bg-primary-50 border border-primary-100 p-4 text-left text-sm text-primary-900">
        <strong>How to play:</strong> rearrange the scrambled letters into the correct library or study word. Use Hint if you get stuck.
      </div>
      <p className="text-sm text-neutral-500 mb-4">Solved: <span className="font-semibold text-neutral-800">{solved}</span></p>
      <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">Unscramble the word</p>
      <div className="text-4xl font-bold tracking-[0.25em] text-primary-700 mb-5">{scrambled}</div>

      <input
        className="input text-center uppercase tracking-widest font-semibold"
        value={guess}
        onChange={(e) => {
          setGuess(e.target.value);
          setStatus('idle');
        }}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        placeholder="Your answer"
        maxLength={current.word.length}
      />

      {status === 'correct' && <p className="text-primary-700 font-medium mt-3">🎉 Correct!</p>}
      {status === 'wrong' && <p className="text-error-700 font-medium mt-3">Not quite — try again.</p>}

      {showHint && <p className="text-sm text-neutral-500 mt-3">💡 {current.hint}</p>}

      <div className="flex gap-2 justify-center mt-5">
        {status === 'correct' ? (
          <button onClick={next} className="btn-primary">Next word</button>
        ) : (
          <>
            <button onClick={check} className="btn-primary">Check</button>
            <button onClick={() => setShowHint(true)} className="btn-ghost">Hint</button>
            <button onClick={next} className="btn-ghost">Skip</button>
          </>
        )}
      </div>
    </div>
  );
}
