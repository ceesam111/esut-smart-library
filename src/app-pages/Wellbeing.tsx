import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import Questionnaire from '@/components/wellbeing/Questionnaire';
import BreathingExercise from '@/components/wellbeing/BreathingExercise';
import GamesHub from '@/components/wellbeing/games/GamesHub';
import { randomQuote } from '@/data/wellbeing';
import BackButton from '@/components/BackButton';

type Tab = 'overview' | 'stress' | 'anxiety' | 'depression' | 'games';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '🌱' },
  { key: 'stress', label: 'Stress', icon: '🧘' },
  { key: 'anxiety', label: 'Anxiety', icon: '💭' },
  { key: 'depression', label: 'Mood', icon: '💛' },
  { key: 'games', label: 'Break & Games', icon: '🎮' },
];

export default function Wellbeing() {
  usePageTitle('Wellbeing Corner');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (params.get('tab') as Tab) || 'overview';
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === initial) ? initial : 'overview');
  const [quote] = useState(randomQuote());

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set('tab', tab);
    setParams(next, { replace: true });
  }, [tab]); // eslint-disable-line

  const returnPath = typeof window !== 'undefined' ? sessionStorage.getItem('studyBreakReturn') : null;
  const handleReturn = () => {
    sessionStorage.removeItem('studyBreakReturn');
    if (returnPath) navigate(returnPath);
    else navigate(-1);
  };

  return (
    <div>
      <div className="page-header">
        <div className="section">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <Link to="/community" className="hover:text-white transition-colors">Community</Link>
              <span>›</span>
              <span>Wellbeing Corner</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Wellbeing Corner</h1>
            <p className="text-white/75 text-lg">
              A calm space to check in, breathe, take a study break and look after your mind.
            </p>
          </div>
        </div>
      </div>

      <div className="section py-8">
        <div className="mb-4">
          <BackButton />
        </div>
        <div className="flex gap-2 border-b border-neutral-200 mb-6 overflow-x-auto scrollbar-thin">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-primary-700 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="card p-6 bg-gradient-to-br from-primary-700 to-primary-900 text-white">
              <p className="text-lg font-medium leading-relaxed">“{quote.text}”</p>
              <p className="text-white/70 text-sm mt-2">— {quote.author}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'stress' as Tab, title: 'Feeling stressed?', desc: 'A 10-question check-in (PSS-10) with tips and an AI companion.', icon: '🧘' },
                { key: 'anxiety' as Tab, title: 'Feeling anxious?', desc: 'GAD-7 screen with grounding strategies and a supportive chat.', icon: '💭' },
                { key: 'depression' as Tab, title: 'Low mood?', desc: 'PHQ-9 screen with caring guidance and counsellor referrals.', icon: '💛' },
              ].map((c) => (
                <button key={c.key} onClick={() => setTab(c.key)} className="card p-5 text-left hover:shadow-card-hover">
                  <div className="text-3xl mb-2">{c.icon}</div>
                  <h3 className="font-bold text-neutral-900 mb-1">{c.title}</h3>
                  <p className="text-sm text-neutral-500">{c.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <BreathingExercise />
              <div className="card p-6 flex flex-col justify-center">
                <h3 className="font-bold text-neutral-900 mb-2">Need a study break?</h3>
                <p className="text-sm text-neutral-500 mb-4">
                  Relax with quick browser games, short music, animations and ambient sounds. Every game includes instructions. We’ll gently nudge you back after 15 minutes.
                </p>
                <button onClick={() => setTab('games')} className="btn-primary self-start">
                  🎮 Take a Break
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <WellbeingCard icon="🎵" title="Short music" text="Use Ambient Sounds for soft piano, flute, guitar, drums, rain, birds and animal-inspired calm tones." />
              <WellbeingCard icon="🌀" title="Calming animation" text="Try the breathing animation first: follow the expanding circle for one minute before returning to study." />
              <WellbeingCard icon="💡" title="Curiosity corner" text="Did you know? A 10-minute walk can improve creative problem solving for a short period after the walk ends." />
            </div>

            <p className="text-xs text-neutral-400">
              The screens here are validated self-reflection tools, not a diagnosis. If you’re struggling, please reach out to the ESUT Counselling Unit or a trusted person.
            </p>
          </div>
        )}

        {tab === 'stress' && <Questionnaire scaleKey="pss10" onTakeBreak={() => setTab('games')} />}
        {tab === 'anxiety' && <Questionnaire scaleKey="gad7" onTakeBreak={() => setTab('games')} />}
        {tab === 'depression' && <Questionnaire scaleKey="phq9" onTakeBreak={() => setTab('games')} />}
        {tab === 'games' && <GamesHub onReturn={handleReturn} />}
      </div>
    </div>
  );
}

function WellbeingCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="card p-5">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-bold text-neutral-900 mb-1">{title}</h3>
      <p className="text-sm text-neutral-500">{text}</p>
    </div>
  );
}
