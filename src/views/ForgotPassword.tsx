import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
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
            Reset Password
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {institutionConfig.name}
          </p>
        </div>

        <div className="card p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-neutral-800 mb-2">Check your email</h2>
                <p className="text-sm text-neutral-500">
                  We've sent a password reset link to <span className="font-medium text-neutral-700">{email}</span>
                </p>
              </div>
              <Link to="/login" className="btn-primary inline-block">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <p className="text-neutral-600 text-sm mb-6">
                Enter the email address associated with your library account and we'll send you a link to reset your password.
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

                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-sm text-neutral-500 mt-6">
                Remember your password?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-800 font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
