import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

const GREEN = '#1A4731';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); } else { setSent(true); }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold font-mono mx-auto mb-3"
            style={{ background: GREEN }}
          >
            AFL
          </div>
          <h1 className="text-2xl font-serif font-semibold text-neutral-900">Reset Your Password</h1>
          <p className="text-sm text-neutral-500 mt-1">{institutionConfig.name}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-neutral-100 p-10">
          {sent ? (
            /* Step 2 — sent confirmation */
            <div className="text-center space-y-5">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                style={{ background: '#d1fae5' }}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Check your email</h2>
                <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
                  We sent a password reset link to{' '}
                  <span className="font-medium text-neutral-700">{email}</span>.
                  The link expires in 1 hour.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            /* Step 1 — form */
            <>
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">Forgot your password?</h2>
              <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
                 Enter the email address on your ESUT Library account and we will send a reset link.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: GREEN }}
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-sm text-neutral-500 text-center mt-5">
                <Link to="/login" className="hover:underline font-medium" style={{ color: GREEN }}>
                  ← Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
