import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';

const SECTIONS = [
  {
    to: '/feed',
    icon: '📰',
    title: 'Community Feed',
    desc: 'See what colleagues are reading, reviewing and discussing across ESUT.',
  },
  {
    to: '/wellbeing',
    icon: '🌱',
    title: 'Wellbeing Corner',
    desc: 'Check-ins, breathing exercises, study-break games and supportive resources.',
  },
  {
    to: '/forum',
    icon: '💬',
    title: 'Discussion Forum',
    desc: 'Ask questions, share knowledge and connect with the library community.',
  },
  {
    to: '/book-clubs',
    icon: '📚',
    title: 'Book Clubs',
    desc: 'Join reading groups and discover what others are enjoying.',
  },
];

export default function Community() {
  usePageTitle('Community & Wellbeing');

  return (
    <div>
      <div className="page-header">
        <div className="section">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>Community &amp; Wellbeing</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Community &amp; Wellbeing</h1>
            <p className="text-white/75 text-lg">
              Connect, learn together and look after your mind — all in one place.
            </p>
          </div>
        </div>
      </div>

      <div className="section py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} className="card p-6 flex items-start gap-4 hover:shadow-card-hover">
              <div className="text-4xl">{s.icon}</div>
              <div>
                <h2 className="font-bold text-neutral-900 text-lg mb-1">{s.title}</h2>
                <p className="text-sm text-neutral-500">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
