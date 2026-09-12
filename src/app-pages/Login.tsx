import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { getDashboardPath, type AppRole } from '@/config/roles.config';
import TurnstileWidget from '@/components/security/TurnstileWidget';
import { verifyTurnstileClient } from '@/lib/turnstileClient';

const GREEN = '#6B1D2A';
const GOLD  = '#D4A017';

const LOCKOUT_KEY   = 'esut_login_attempts';
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000;

interface AttemptRecord { count: number; lockedUntil: number | null; }

function getAttempts(email: string): AttemptRecord {
  try {
    const raw = sessionStorage.getItem(`${LOCKOUT_KEY}:${email}`);
    return raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
  } catch { return { count: 0, lockedUntil: null }; }
}
function setAttempts(email: string, record: AttemptRecord) {
  sessionStorage.setItem(`${LOCKOUT_KEY}:${email}`, JSON.stringify(record));
}
function clearAttempts(email: string) {
  sessionStorage.removeItem(`${LOCKOUT_KEY}:${email}`);
}

function PasswordInput({
  id, value, onChange, label,
}: { id: string; value: string; onChange: (v: string) => void; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="label mb-0">{label}</label>
        {id === 'password' && (
          <Link to="/forgot-password" className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
            Forgot your password?
          </Link>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input pr-10"
          placeholder="••••••••"
          required
          autoComplete={id === 'password' ? 'current-password' : 'new-password'}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          aria-label={show ? 'Hide' : 'Show'}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const id = setTimeout(() => setLockoutRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(id);
  }, [lockoutRemaining]);

  const getLockoutState = () => {
    if (!email) return { locked: false, secondsLeft: 0 };
    const record = getAttempts(email);
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      return { locked: true, secondsLeft: Math.ceil((record.lockedUntil - Date.now()) / 1000) };
    }
    return { locked: false, secondsLeft: 0 };
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { locked, secondsLeft } = getLockoutState();
    if (locked) {
      const mins = Math.ceil(secondsLeft / 60);
      setError(`Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
      setLockoutRemaining(secondsLeft);
      return;
    }
    setLoading(true);
    try {
      await verifyTurnstileClient(turnstileToken, 'login');
    } catch (challengeError) {
      setLoading(false);
      setError((challengeError as Error).message);
      return;
    }
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      const record = getAttempts(email);
      const newCount = record.count + 1;
      if (newCount >= MAX_ATTEMPTS) {
        setAttempts(email, { count: newCount, lockedUntil: Date.now() + LOCKOUT_MS });
        setError('Too many failed attempts. Account locked for 15 minutes.');
        setLockoutRemaining(LOCKOUT_MS / 1000);
      } else {
        setAttempts(email, { count: newCount, lockedUntil: null });
        const rem = MAX_ATTEMPTS - newCount;
        setError(`${err.message}${rem <= 2 ? ` (${rem} attempt${rem !== 1 ? 's' : ''} remaining)` : ''}`);
      }
      return;
    }
    clearAttempts(email);
    const token = data.session?.access_token;
    if (token) {
      await fetch('/api/registration/sync-auth-verification', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
    }

    const userId = data.user?.id;
    let role: AppRole | null = null;
    if (userId) {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('patrons').select('status, account_role, main_library_access_at').eq('user_id', userId).maybeSingle(),
      ]);
      const hasAccess = !profile || profile.status === 'active' || !!profile.main_library_access_at;
      const userRoles = hasAccess ? (roles ?? []).map((row: { role: AppRole }) => row.role) : [];
      const priority: AppRole[] = ['super_admin', 'librarian', 'faculty_librarian', 'researcher_lecturer', 'student', 'admin_staff', 'guest'];
      role = priority.find((candidate) => userRoles.includes(candidate)) ?? (hasAccess ? (profile?.account_role as AppRole | null) : null) ?? null;
    }
    navigate(getDashboardPath(role));
  }

  const { locked } = getLockoutState();

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <img src="/assets/esut-logo.png" alt="ESUT Logo" className="w-14 h-14 mx-auto mb-3 rounded-lg object-contain" />
          <h1 className="text-2xl font-serif font-semibold text-neutral-900">
            Sign In to ESUT Library
          </h1>
          <p className="text-sm text-neutral-500 mt-1">{institutionConfig.name}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-neutral-100 p-10">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          {locked && lockoutRemaining > 0 && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Account locked — {Math.floor(lockoutRemaining / 60)}:{String(lockoutRemaining % 60).padStart(2, '0')} remaining
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@university.edu.ng"
                required
                autoComplete="email"
              />
            </div>

            <PasswordInput id="password" value={password} onChange={setPassword} label="Password" />

            <TurnstileWidget action="login" onToken={setTurnstileToken} />

            <button
              type="submit"
              disabled={loading || locked}
              className="w-full py-3 rounded-lg text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ background: GREEN }}
            >
              {loading ? 'Signing in…' : locked ? 'Account Locked' : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-neutral-500 text-center mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold hover:underline" style={{ color: GOLD }}>
              Sign Up
            </Link>
          </p>
        </div>

        <p className="text-neutral-400 text-xs text-center italic mt-4">
          One account gives you access to all ESUT Library branches and faculty libraries.
        </p>
      </div>
    </div>
  );
}
