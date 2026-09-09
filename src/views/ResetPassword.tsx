import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a valid reset token
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        // If no session, the link might be invalid or expired
        // But Supabase handles this via the URL params, so we let it proceed
      }
    });
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error: err } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold font-mono mx-auto mb-3"
            style={{ background: 'var(--color-primary)' }}
          >
            {institutionConfig.shortName.slice(0, 3)}
          </div>
          <h1 className="text-2xl font-serif font-semibold text-primary-800">
            Set New Password
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {institutionConfig.name}
          </p>
        </div>

        <div className="card p-6">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-neutral-800 mb-2">Password Updated</h2>
                <p className="text-sm text-neutral-500">
                  Your password has been reset. Redirecting to dashboard...
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-neutral-600 text-sm mb-6">
                Enter a new password for your library account.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-error-50 border border-error-200 text-error-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="label">New Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="label">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    placeholder="Re-enter new password"
                    required
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Updating...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
