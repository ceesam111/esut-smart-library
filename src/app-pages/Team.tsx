import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';

interface Member {
  id: string;
  name: string;
  title: string;
  qual: string;
  bio: string;
  email: string;
  initials: string;
  photo_url: string | null;
}

const AVATAR_COLORS = [
  '#6B1D2A', '#8f173b', '#ab1842', '#cc2252',
  '#194f2f', '#0a2e16', '#134524', '#2D6A4F',
];

export default function Team() {
  usePageTitle('Meet Our Library Team');
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('list_team_members_public');
      setTeam((data as Member[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="pt-20" style={{ background: '#6B1D2A' }}>
        <div className="max-w-4xl mx-auto px-6 py-16 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Meet Our Library Team</h1>
          <p className="text-lg text-white/80">The dedicated professionals behind ESUT Smart Library</p>
        </div>
      </div>

      {/* Team grid */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <p className="text-center text-neutral-400 text-sm">Loading team…</p>
          ) : team.length === 0 ? (
            <p className="text-center text-neutral-400 text-sm">Team members will be listed here soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {team.map((m, i) => (
                <div key={m.id} className="flex flex-col items-center text-center group">
                  {m.photo_url ? (
                    <img
                      src={m.photo_url}
                      alt={m.name}
                      className="w-24 h-24 rounded-full object-cover shadow-md mb-4 transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md mb-4 transition-transform group-hover:scale-105"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                    >
                      {m.initials}
                    </div>
                  )}
                  <p className="font-bold text-neutral-900 text-sm leading-tight">{m.name}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: '#6B1D2A' }}>{m.title}</p>
                  {m.qual && <p className="text-xs text-neutral-400 mt-1">{m.qual}</p>}
                  {m.bio && <p className="text-xs text-neutral-600 mt-2 leading-relaxed">{m.bio}</p>}
                  {m.email && (
                    <a
                      href={`mailto:${m.email}`}
                      className="text-xs mt-2 hover:underline"
                      style={{ color: '#6B1D2A' }}
                    >
                      {m.email}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Join the team CTA */}
      <section className="py-12 px-6 bg-neutral-50 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Work With Us</h2>
          <p className="text-neutral-500 text-sm mb-4">
            Interested in joining the ESUT Library team? Current vacancies are advertised through the ESUT human resources portal.
          </p>
          <Link to="/contact" className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ background: '#6B1D2A' }}>
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
