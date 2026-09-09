import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { getDashboardPath, type AppRole } from '@/config/roles.config';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    
    let role: AppRole | null = null;
    if (data?.user) {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', data.user.id),
        supabase.from('patrons').select('status, account_role, main_library_access_at').eq('user_id', data.user.id).maybeSingle(),
      ]);
      const hasAccess = !profile || profile.status === 'active' || !!profile.main_library_access_at;
      const userRoles = hasAccess ? (roles ?? []).map((row: { role: AppRole }) => row.role) : [];
      const priority: AppRole[] = ['super_admin', 'librarian', 'faculty_librarian', 'researcher_lecturer', 'student', 'admin_staff', 'guest'];
      role = priority.find((candidate) => userRoles.includes(candidate)) ?? (hasAccess ? (profile?.account_role as AppRole | null) : null) ?? null;
    }
    navigate(getDashboardPath(role));
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-2/5 p-12 text-white"
        style={{ background: 'linear-gradient(160deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
      >
        <div>
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold font-mono mb-6"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            {institutionConfig.shortName.slice(0, 3)}
          </div>
          <h1 className="text-3xl font-serif font-semibold mb-2">
            {institutionConfig.name}
          </h1>
          <p className="text-white/70">ESUT Smart Library</p>
        </div>
        <div className="space-y-4 text-sm text-white/60">
          <div className="flex items-center gap-2">
            <span>📚</span> 12,000+ catalogued resources
          </div>
          <div className="flex items-center gap-2">
            <span>🤖</span> AI Librarian — {institutionConfig.librarianName}
          </div>
          <div className="flex items-center gap-2">
            <span>🎓</span> Thesis submission portal
          </div>
          <div className="flex items-center gap-2">
            <span>🌐</span> 250M+ federated academic works
          </div>
        </div>
        <p className="text-xs text-white/40">
          {institutionConfig.regulatoryBody}-regulated &bull; Session {institutionConfig.currentSession}
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-neutral-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold font-mono mx-auto mb-2"
              style={{ background: 'var(--color-primary)' }}
            >
              {institutionConfig.shortName.slice(0, 3)}
            </div>
            <h1 className="font-serif font-semibold text-primary-800 text-lg">
              {institutionConfig.shortName} Library
            </h1>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-serif font-semibold text-neutral-800 mb-1">
              Welcome back
            </h2>
            <p className="text-neutral-500 text-sm mb-6">
              Sign in to your library account
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-error-50 border border-error-200 text-error-700 text-sm">
                {error}
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
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="label mb-0">Password</label>
                  <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-800">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-neutral-500 mt-6">
              New patron?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-800 font-medium">
                Create an account
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-neutral-400 mt-6">
            {institutionConfig.name} &bull; {institutionConfig.supportEmail}
          </p>
        </div>
      </div>
    </div>
  );
}
