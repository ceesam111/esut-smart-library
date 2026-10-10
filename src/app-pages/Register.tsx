import { useState } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import StudentForm from '@/components/auth/StudentForm';
import ResearcherForm from '@/components/auth/ResearcherForm';
import AdminStaffForm from '@/components/auth/AdminStaffForm';
import LibrarianForm from '@/components/auth/LibrarianForm';
import RegistrationSuccessModal from '@/components/auth/RegistrationSuccessModal';
import type { RegisterResult } from '@/lib/registration';
import { useI18n, type TranslationKey } from '@/lib/i18n';


const GOLD = '#D4A017';

type Kind = 'student' | 'researcher' | 'admin_staff' | 'librarian';

const ACCOUNT_TYPES: { kind: Kind; titleKey: TranslationKey; descKey: TranslationKey; icon: string }[] = [
  { kind: 'student', titleKey: 'auth.typeStudent', descKey: 'auth.typeStudentDesc', icon: '🎓' },
  { kind: 'researcher', titleKey: 'auth.typeResearcher', descKey: 'auth.typeResearcherDesc', icon: '🔬' },
  { kind: 'admin_staff', titleKey: 'auth.typeAdminStaff', descKey: 'auth.typeAdminStaffDesc', icon: '🗂️' },
  { kind: 'librarian', titleKey: 'auth.typeLibrarian', descKey: 'auth.typeLibrarianDesc', icon: '📚' },
];

export default function Register() {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind | null>(null);
  const [done, setDone] = useState<RegisterResult | null>(null);

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4">
      <div className="max-w-[560px] mx-auto">
        <div className="text-center mb-8">
          <img src="/assets/esut-logo.png" alt="ESUT Logo" className="w-14 h-14 mx-auto mb-3 rounded-lg object-contain" />
          <h1 className="text-2xl font-serif font-semibold text-neutral-900">{t('auth.joinTitle')}</h1>
          <p className="text-sm text-neutral-500 mt-1">{institutionConfig.name}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-neutral-100 p-8 sm:p-10">
          {!kind ? (
            <>
              <h2 className="text-lg font-semibold text-neutral-800 mb-1">{t('auth.chooseAccountType')}</h2>
              <p className="text-sm text-neutral-500 mb-5">{t('auth.accountTypeHint')}</p>
              <div className="grid gap-3">
                {ACCOUNT_TYPES.map((a) => (
                  <button
                    key={a.kind}
                    onClick={() => setKind(a.kind)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/40 transition-colors text-left"
                  >
                    <span className="text-2xl">{a.icon}</span>
                    <span className="flex-1">
                      <span className="block font-semibold text-neutral-800">{t(a.titleKey)}</span>
                      <span className="block text-sm text-neutral-500">{t(a.descKey)}</span>
                    </span>
                    <span className="text-neutral-300">→</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setKind(null)} className="text-sm text-neutral-500 hover:text-neutral-800 mb-4">{t('auth.changeAccountType')}</button>
              <h2 className="text-lg font-semibold text-neutral-800 mb-5">
                {t('auth.registrationHeading', { type: t(ACCOUNT_TYPES.find((a) => a.kind === kind)?.titleKey ?? 'auth.typeStudent') })}
              </h2>
              {kind === 'student' && <StudentForm onSuccess={setDone} />}
              {kind === 'researcher' && <ResearcherForm onSuccess={setDone} />}
              {kind === 'admin_staff' && <AdminStaffForm onSuccess={setDone} />}
              {kind === 'librarian' && <LibrarianForm onSuccess={setDone} />}
            </>
          )}

          <p className="text-sm text-neutral-500 text-center mt-6">
            {t('auth.alreadyAccount')}{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: GOLD }}>{t('auth.signIn')}</Link>
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
