import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import type { RegisterResult } from '@/lib/registration';

const GREEN = '#6B1D2A';
const GOLD = '#D4A017';

const ANIM_CSS = `
@keyframes regFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes regRise { from { opacity: 0; transform: translateY(18px) scale(.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
@keyframes regPop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
@keyframes regDraw { to { stroke-dashoffset: 0 } }
@keyframes regHalo { 0% { transform: scale(.85); opacity: .55 } 70% { transform: scale(1.35); opacity: 0 } 100% { transform: scale(1.35); opacity: 0 } }
@keyframes regSheen { 0% { transform: translateX(-120%) } 100% { transform: translateX(220%) } }
.reg-fade { animation: regFade .28s ease both }
.reg-rise { animation: regRise .45s cubic-bezier(.22,1,.36,1) both }
.reg-pop { animation: regPop .5s cubic-bezier(.22,1,.36,1) .12s both }
.reg-halo { animation: regHalo 1.5s ease-out .35s both }
.reg-draw { stroke-dasharray: 48; stroke-dashoffset: 48; animation: regDraw .5s ease-out .5s forwards }
.reg-sheen::after {
  content: ''; position: absolute; inset: 0; overflow: hidden;
  background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.45) 50%, transparent 65%);
  transform: translateX(-120%); animation: regSheen 2.6s ease-in-out 1s infinite;
}
@media (prefers-reduced-motion: reduce) {
  .reg-fade, .reg-rise, .reg-pop, .reg-halo, .reg-draw, .reg-sheen::after { animation: none !important; stroke-dashoffset: 0 !important }
}
`;

function StatusRow({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ background: ok ? '#15803D' : GOLD }}
        aria-hidden="true"
      >
        {ok ? '✓' : 'i'}
      </span>
      <span className="text-sm leading-relaxed text-neutral-700">{children}</span>
    </li>
  );
}

export default function RegistrationSuccessModal({
  result,
  onClose,
}: {
  result: RegisterResult;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const emailGate = !!result.requiresEmailVerification;
  const autoVerified = !!result.autoVerified;
  const emailSent = !!result.verificationEmailSent;
  const emailPaused = emailGate && !emailSent && !autoVerified;

  const title = result.directAccess
    ? 'Registration Complete'
    : emailGate
      ? 'Registration Successful'
      : 'Registration Received';

  const lead = result.directAccess
    ? 'Your account is active. You can sign in and start using the library dashboard immediately.'
    : autoVerified
      ? 'Your registration is complete and your account is ready. The email service is unavailable, so no verification link was sent — sign in now with your email and password.'
      : emailGate
        ? institutionCopy(result)
        : 'Your account has been created and is pending library approval. You will be notified once it is active.';

  if (!mounted) return null;

  // Portalled to document.body so the fixed navigation bar (z-50) and the
  // page's own stacking context (main[style] z-index:2) cannot cover it.
  return createPortal(
    <div
      className="reg-fade fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-neutral-900/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <style>{ANIM_CSS}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-success-title"
        className="reg-rise relative my-auto w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_80px_-20px_rgba(23,20,20,.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          ×
        </button>

        <div className="reg-sheen relative overflow-hidden px-8 pb-16 pt-9 text-center" style={{ background: `linear-gradient(140deg, ${GREEN} 0%, #8E2A3C 55%, ${GREEN} 100%)` }}>
          <span className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 rounded-full opacity-25" style={{ background: GOLD }} />
          <span className="pointer-events-none absolute -bottom-16 -right-6 h-40 w-40 rounded-full bg-white opacity-10" />

          <div className="relative mx-auto mb-4 h-20 w-20">
            <span className="reg-halo absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(212,160,23,.75) 0%, rgba(212,160,23,0) 70%)' }} />
            <div className="reg-pop relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/85 bg-white shadow-lg">
              <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
                <path
                  className="reg-draw"
                  d="M10 21.5 L17.5 29 L30.5 13.5"
                  fill="none"
                  stroke={GREEN}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div className="relative">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.22em] text-white/70">ESUT Smart Library</p>
            <h1 id="reg-success-title" className="font-serif text-2xl font-semibold text-white">
              {title}
            </h1>
          </div>
        </div>

        <div className="px-7 pb-7 pt-6">
          <p className="mb-5 text-center text-sm leading-relaxed text-neutral-600">{lead}</p>

          <ul className="mb-5 space-y-3 rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4">
            <StatusRow ok>Account created and your details saved securely.</StatusRow>
            {autoVerified ? (
              <StatusRow ok>
                <span className="font-medium text-neutral-800">Email verification skipped.</span>{' '}
                The email service is unavailable, so no link was sent — your account is active and you can sign in now.
              </StatusRow>
            ) : emailGate ? (
              emailSent ? (
                <StatusRow ok>Verification link sent to your email address.</StatusRow>
              ) : (
                <StatusRow ok={false}>
                  <span className="font-medium text-neutral-800">Verification email paused.</span>{' '}
                  The email service is busy — nothing was sent, but your registration succeeded.
                </StatusRow>
              )
            ) : null}
            {result.requiresBranchApproval && (
              <StatusRow ok={false}>
                {autoVerified
                  ? 'Sign-in works now; the library team reviews and approves access to privileged accounts.'
                  : emailGate
                    ? 'After you verify, the library team reviews and approves access.'
                    : 'The library team reviews and approves your account before access is granted.'}
              </StatusRow>
            )}
          </ul>

          {autoVerified ? (
            <div className="mb-5 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-xs leading-relaxed text-primary-900">
              <span className="font-semibold">Good to know:</span>{' '}
              {result.emailNotice ||
                'The email service is unavailable, so we skipped email verification and activated your account. You can sign in immediately.'}
            </div>
          ) : emailPaused ? (
            <div className="mb-5 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
              <span className="font-semibold">Good to know:</span> {result.emailNotice ||
                'Your account is safe and created. Email delivery can be retried from the sign-in page without losing your registration.'}
            </div>
          ) : null}

          <div className="space-y-2.5">
            <Link
              to={result.directAccess ? '/dashboard' : '/login'}
              className="block w-full rounded-xl py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ background: GREEN }}
              onClick={onClose}
            >
              {result.directAccess ? 'Go to My Dashboard' : 'Continue to Sign In'}
            </Link>
            {!result.directAccess && (
              <button
                type="button"
                onClick={onClose}
                className="block w-full rounded-xl border border-neutral-200 py-3 text-center text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                Back to Registration
              </button>
            )}
            <Link to="/" className="block w-full pb-1 text-center text-xs font-medium text-neutral-400 hover:text-neutral-600" onClick={onClose}>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function institutionCopy(result: RegisterResult) {
  if (result.requiresBranchApproval && institutionConfig.libraryMode === 'multi') {
    return 'We sent a verification link to your email. After verifying, you can use the main library dashboard while your selected branch library reviews branch access.';
  }
  if (result.requiresBranchApproval) {
    return 'We created your account and sent a verification link to your email. Verify your address, then a library administrator reviews access to privileged accounts.';
  }
  return 'We created your account and sent a verification link to your email. Please verify your address before signing in to your dashboard.';
}
