import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';

interface Member {
  id: string;
  name: string;
  title: string;
  photo: string;
}

const TEAM: Member[] = [
  {
    id: '1',
    name: 'Prof. Aloysius-Michaels Okolie',
    title: 'Vice-Chancellor',
    photo: '/assets/staff/vice_chancellor.jpeg',
  },
  {
    id: '2',
    name: 'Prof. Chike E. Nwoha',
    title: 'Deputy Vice-Chancellor',
    photo: '/assets/staff/deputy_vice_chancellor.jpeg',
  },
  {
    id: '3',
    name: 'Dr. Uzoamaka Ogwo',
    title: 'University Librarian',
    photo: '/assets/staff/university_librarian.jpeg',
  },
  {
    id: '4',
    name: 'Dr. Augustine Ikechukwu Ojeh',
    title: 'Bursar',
    photo: '/assets/staff/bursar.jpeg',
  },
  {
    id: '5',
    name: 'Mr. Ambrose G. Ugwu',
    title: 'Registrar',
    photo: '/assets/staff/registrar.jpeg',
  },
];

export default function Team() {
  usePageTitle('Our Library Leadership');

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-20" style={{ background: '#6B1D2A' }}>
        <div className="max-w-4xl mx-auto px-6 py-16 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Our Library Leadership</h1>
          <p className="text-lg text-white/80">The dedicated professionals behind ESUT Smart Library</p>
        </div>
      </div>

      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
            {TEAM.map((m) => (
              <div key={m.id} className="flex flex-col items-center text-center group">
                <div className="w-32 h-32 rounded-full overflow-hidden shadow-md mb-4 border-3 border-white ring-2 transition-transform group-hover:scale-105" style={{ borderColor: '#6B1D2A', ringColor: '#6B1D2A' }}>
                  <img
                    src={m.photo}
                    alt={m.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="font-bold text-neutral-900 text-sm leading-tight">{m.name}</p>
                <p className="text-xs font-semibold mt-1" style={{ color: '#6B1D2A' }}>{m.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
