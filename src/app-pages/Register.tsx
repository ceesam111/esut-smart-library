import { useState } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import StudentForm from '@/components/auth/StudentForm';
import ResearcherForm from '@/components/auth/ResearcherForm';
import AdminStaffForm from '@/components/auth/AdminStaffForm';
import LibrarianForm from '@/components/auth/LibrarianForm';
import RegistrationSuccessModal from '@/components/auth/RegistrationSuccessModal';
import type { RegisterResult } from '@/lib/registration';

const GREEN = '#6B1D2A';
const GOLD = '#D4A017';

type Kind = 'student' | 'researcher' | 'admin_staff' | 'librarian';

const ACCOUNT_TYPES: { kind: Kind; title: string; desc: string; icon: string }[] = [
  { kind: 'student', title: 'Student', desc: 'Undergraduate, Postgraduate or PostDoc', icon: '🎓' },
  { kind: 'researcher', title: 'Researcher / Lecturer', desc: 'Academic & research staff', icon: '🔬' },
  { kind: 'admin_staff', title: 'Administrative Staff', desc: 'Non-academic university staff', icon: '🗂️' },
  { kind: 'librarian', title: 'Librarian', desc: 'Library professional (approval required)', icon: '📚' },
];

export default function Register() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [done, setDone] = useState<RegisterResult | null>(null);

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4">
      <div className="max-w-[560px] mx-auto">
        <div className="text-center mb-8">
          <img src="/assets/esut-logo.png" alt="ESUT Logo" className="w-14 h-14 mx-auto mb-3 rounded-lg object-contain" />
          <h1 className="text-2xl font-serif font-semibold text-neutral-900">Join ESUT Smart Library</h1>
          <p className="text-sm text-neutral-500 mt-1">{institutionConfig.name}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-neutral-100 p-8 sm:p-10">
          {!kind ? (
            <>
              <h2 className="text-lg font-semibold text-neutral-800 mb-1">Choose your account type</h2>
              <p className="text-sm text-neutral-500 mb-5">This determines your registration form and library access.</p>
              <div className="grid gap-3">
                {ACCOUNT_TYPES.map((t) => (
                  <button
                    key={t.kind}
                    onClick={() => setKind(t.kind)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/40 transition-colors text-left"
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="flex-1">
                      <span className="block font-semibold text-neutral-800">{t.title}</span>
                      <span className="block text-sm text-neutral-500">{t.desc}</span>
                    </span>
                    <span className="text-neutral-300">→</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setKind(null)} className="text-sm text-neutral-500 hover:text-neutral-800 mb-4">← Change account type</button>
              <h2 className="text-lg font-semibold text-neutral-800 mb-5">
                {ACCOUNT_TYPES.find((t) => t.kind === kind)?.title} Registration
              </h2>
              {kind === 'student' && <StudentForm onSuccess={setDone} />}
              {kind === 'researcher' && <ResearcherForm onSuccess={setDone} />}
              {kind === 'admin_staff' && <AdminStaffForm onSuccess={setDone} />}
              {kind === 'librarian' && <LibrarianForm onSuccess={setDone} />}
            </>
          )}

          <p className="text-sm text-neutral-500 text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: GOLD }}>Sign In</Link>
          </p>
        </div>
      </div>

      {done && (
        <RegistrationSuccessModal
          result={done}
          onClose={() => {
            setDone(null);
            setKind(null);
          }}
        />
      )}
    </div>
  );
}
