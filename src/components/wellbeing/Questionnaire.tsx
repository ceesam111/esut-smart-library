import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SCALES,
  scoreScale,
  bandFor,
  randomQuote,
  SUPPORT_CONTACTS,
  type ScaleKey,
} from '@/data/wellbeing';
import BreathingExercise from './BreathingExercise';
import WellbeingCheckin from './WellbeingCheckin';

export default function Questionnaire({
  scaleKey,
  onTakeBreak,
}: {
  scaleKey: ScaleKey;
  onTakeBreak: () => void;
}) {
  const scale = SCALES[scaleKey];
  const [answers, setAnswers] = useState<(number | null)[]>(Array(scale.questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = answers.every((a) => a !== null);
  const score = submitted ? scoreScale(scale, answers as number[]) : 0;
  const band = submitted ? bandFor(scale, score) : null;
  const resultQuote = submitted ? resultQuoteFor(scale.topic, band!.label, score) : randomQuote();
  const maxScore = scale.questions.length * scale.options[scale.options.length - 1].value;

  const setAnswer = (qi: number, val: number) =>
    setAnswers((prev) => prev.map((a, i) => (i === qi ? val : a)));

  const reset = () => {
    setAnswers(Array(scale.questions.length).fill(null));
    setSubmitted(false);
  };

  if (!submitted) {
    return (
      <div className="space-y-5">
        <div className="card p-5 bg-primary-50 border-primary-100">
          <h2 className="font-bold text-primary-900">{scale.title}</h2>
          <p className="text-sm text-primary-800/80 mt-1">{scale.subtitle}</p>
          <p className="text-sm text-neutral-600 mt-3">{scale.instructions}</p>
        </div>

        <div className="space-y-3">
          {scale.questions.map((q, qi) => (
            <div key={qi} className="card p-4">
              <p className="text-sm font-medium text-neutral-800 mb-3">
                <span className="text-neutral-400 mr-1">{qi + 1}.</span> {q}
              </p>
              <div className="flex flex-wrap gap-2">
                {scale.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAnswer(qi, opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      answers[qi] === opt.value
                        ? 'bg-primary-700 text-white border-primary-700'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 sticky bottom-4">
          <p className="text-xs text-neutral-400">
            {answers.filter((a) => a !== null).length}/{scale.questions.length} answered
          </p>
          <button onClick={() => setSubmitted(true)} disabled={!allAnswered} className="btn-primary">
            See my results
          </button>
        </div>
        <p className="text-xs text-neutral-400">
          This is a self-reflection screen, not a diagnosis. If you’re worried about your wellbeing, please reach out to a counsellor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Result */}
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-neutral-500">{scale.topic} screen result</p>
            <h2 className="text-2xl font-bold text-neutral-900">{band!.label}</h2>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary-700">{score}</div>
            <div className="text-xs text-neutral-400">out of {maxScore}</div>
          </div>
        </div>
        <div className="w-full h-2.5 rounded-full bg-neutral-100 mt-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-600"
            style={{ width: `${Math.min(100, (score / maxScore) * 100)}%` }}
          />
        </div>
        <p className="text-sm text-neutral-600 mt-4 leading-relaxed">{band!.interpretation}</p>
      </div>

      {/* Referral panel */}
      {band!.referral && (
        <div className="card p-6 border-amber-200 bg-amber-50">
          <h3 className="font-bold text-amber-900 mb-1">Please speak with a counsellor 💛</h3>
          <p className="text-sm text-amber-900/80 mb-4">
            Your responses suggest you could benefit from extra support. You don’t have to go through this alone.
          </p>
          <div className="space-y-2">
            {SUPPORT_CONTACTS.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-3 bg-white rounded-lg p-3 border border-amber-100">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{c.name}</p>
                  <p className="text-xs text-neutral-500">{c.detail}</p>
                </div>
                {c.href.startsWith('/') ? (
                  <Link to={c.href} className="btn-outline shrink-0 !py-1.5 !px-3 text-xs">{c.cta}</Link>
                ) : (
                  <a href={c.href} className="btn-outline shrink-0 !py-1.5 !px-3 text-xs">{c.cta}</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coping strategies */}
      <div className="card p-6">
        <h3 className="font-bold text-neutral-900 mb-3">Personalised coping strategies</h3>
        <ul className="space-y-2">
          {band!.tips.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
              <span className="text-primary-600 mt-0.5">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Breathing + quote */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BreathingExercise />
        <div className="card p-6 flex flex-col justify-center bg-gradient-to-br from-primary-700 to-primary-900 text-white">
          <span className="text-4xl mb-3">“</span>
          <p className="text-lg font-medium leading-relaxed">{resultQuote.text}</p>
          <p className="text-white/70 text-sm mt-3">— {resultQuote.author}</p>
        </div>
      </div>

      {/* AI check-in */}
      <WellbeingCheckin topic={scale.topic} />

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button onClick={onTakeBreak} className="btn-primary">
          🎮 Take a Break
        </button>
        <button onClick={reset} className="btn-ghost">
          Retake screen
        </button>
      </div>
    </div>
  );
}

function resultQuoteFor(topic: string, label: string, score: number) {
  const serious = /high|severe|moderate/i.test(label);
  const quotes = serious
    ? [
      { text: `Your ${topic.toLowerCase()} score is information, not a verdict. One kind next step is enough for now.`, author: 'ESUT Wellbeing Corner' },
      { text: 'You do not have to solve everything today. Start with safety, breath, water, and one trusted person.', author: 'ESUT Wellbeing Corner' },
      { text: 'Asking for support is not weakness; it is a practical study skill for difficult seasons.', author: 'ESUT Wellbeing Corner' },
    ]
    : [
      { text: `Your ${topic.toLowerCase()} check-in looks manageable today. Keep protecting the routines that help you.`, author: 'ESUT Wellbeing Corner' },
      { text: 'A calm mind is maintained in small habits: rest, movement, connection, and meaningful work.', author: 'ESUT Wellbeing Corner' },
      { text: 'Notice what is working, then repeat it gently.', author: 'ESUT Wellbeing Corner' },
    ];
  return quotes[score % quotes.length];
}
