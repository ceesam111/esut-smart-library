import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import StudentForm from '@/components/auth/StudentForm';
import ResearcherForm from '@/components/auth/ResearcherForm';
import AdminStaffForm from '@/components/auth/AdminStaffForm';
import LibrarianForm from '@/components/auth/LibrarianForm';
import type { RegisterResult } from '@/lib/registration';
import TurnstileWidget from '@/components/security/TurnstileWidget';

const GREEN = '#1A4731';
const GOLD = '#C9A84C';

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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);

  useEffect(() => {
    fetch('/api/security/turnstile/config')
      .then((res) => res.ok ? res.json() : null)
      .then((json) => setTurnstileRequired(!!json?.siteKey))
      .catch(() => setTurnstileRequired(false));
  }, []);

  if (done) return <SuccessScreen result={done} />;

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4">
      <div className="max-w-[560px] mx-auto">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold font-mono mx-auto mb-3" style={{ background: GREEN }}>AFL</div>
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
                    onClick={() => { setTurnstileToken(null); setKind(t.kind); }}
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
              <button onClick={() => { setTurnstileToken(null); setKind(null); }} className="text-sm text-neutral-500 hover:text-neutral-800 mb-4">← Change account type</button>
              <h2 className="text-lg font-semibold text-neutral-800 mb-5">
                {ACCOUNT_TYPES.find((t) => t.kind === kind)?.title} Registration
              </h2>
              {kind === 'student' && <StudentForm onSuccess={setDone} turnstileToken={turnstileToken} turnstileRequired={turnstileRequired} turnstileWidget={<RegistrationTurnstile onToken={setTurnstileToken} />} />}
              {kind === 'researcher' && <ResearcherForm onSuccess={setDone} turnstileToken={turnstileToken} turnstileRequired={turnstileRequired} turnstileWidget={<RegistrationTurnstile onToken={setTurnstileToken} />} />}
              {kind === 'admin_staff' && <AdminStaffForm onSuccess={setDone} turnstileToken={turnstileToken} turnstileRequired={turnstileRequired} turnstileWidget={<RegistrationTurnstile onToken={setTurnstileToken} />} />}
              {kind === 'librarian' && <LibrarianForm onSuccess={setDone} turnstileToken={turnstileToken} turnstileRequired={turnstileRequired} turnstileWidget={<RegistrationTurnstile onToken={setTurnstileToken} />} />}
            </>
          )}

          <p className="text-sm text-neutral-500 text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: GOLD }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function RegistrationTurnstile({ onToken }: { onToken: (token: string | null) => void }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-sm font-semibold text-neutral-800 mb-2">Security verification</p>
      <TurnstileWidget action="registration" onToken={onToken} />
    </div>
  );
}

function SuccessScreen({ result }: { result: RegisterResult }) {
  const title = result.directAccess ? 'Registration Complete' : result.requiresEmailVerification ? 'Verify Your Email' : 'Registration Received';
  const body = result.directAccess
    ? 'Your account is active. You can sign in and start using the library dashboard immediately.'
    : result.requiresEmailVerification && result.requiresBranchApproval
      ? institutionConfig.libraryMode === 'multi'
        ? 'We sent a verification link to your email. After verification, you can use the main library dashboard while your selected branch library reviews and approves full branch access.'
        : 'We sent a verification link to your email. Please verify your email address before signing in to your dashboard.'
      : result.requiresEmailVerification
        ? 'We sent a verification link to your email. Please verify your email address before signing in to your dashboard.'
        : 'Your account has been created and is now pending library approval. You will be notified once your account is active.';

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px] bg-white rounded-xl shadow-lg border border-neutral-100 p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-5 text-3xl">{result.directAccess ? '✓' : result.requiresEmailVerification ? '✉' : '⏳'}</div>
        <h1 className="text-2xl font-serif font-semibold text-neutral-900 mb-2">{title}</h1>
        <p className="text-neutral-600 text-sm leading-relaxed mb-6">
          {body}
        </p>
        {result.requiresEmailVerification && !result.verificationEmailSent && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Your account was created, but the verification email could not be confirmed as sent. Please contact the library desk if it does not arrive shortly.
          </div>
        )}
        <div className="space-y-3">
          {result.directAccess ? <Link to="/dashboard" className="btn-primary w-full block">Go to Dashboard</Link> : <Link to="/login" className="btn-primary w-full block">Go to Login</Link>}
          <Link to="/" className="btn-outline w-full block">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
