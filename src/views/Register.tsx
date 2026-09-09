import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

const patronCategories = [
  'Undergraduate',
  'Postgraduate Taught',
  'Postgraduate Research',
  'Academic Staff',
  'Non-Academic Staff',
  'Visiting Scholar',
  'External Reader',
  'Alumni',
];

const levels = ['100L', '200L', '300L', '400L', '500L', 'PG1', 'PG2'];

type Step = 1 | 2 | 3;

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep]   = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '',
    dateOfBirth: '', gender: '',
    patronCategory: '',
    // Student fields
    matricNumber: '', faculty: '', department: '', level: '', programme: '',
    // Staff fields
    staffId: '', rank: '',
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const isStudent = ['Undergraduate', 'Postgraduate Taught', 'Postgraduate Research'].includes(form.patronCategory);
  const isStaff   = ['Academic Staff', 'Non-Academic Staff'].includes(form.patronCategory);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    });

    if (authErr || !authData.user) {
      setError(authErr?.message ?? 'Registration failed. Please try again.');
      setLoading(false);
      return;
    }

    const facultyCode = institutionConfig.faculties.find(f => f.name === form.faculty)?.code ?? '';
    const patronId = `${institutionConfig.institutionCode}-${facultyCode || 'GEN'}-${Math.floor(100000 + Math.random() * 900000)}`;

    const { error: dbErr } = await supabase.from('patrons').insert({
      user_id: authData.user.id,
      patron_id: patronId,
      full_name: form.fullName,
      email: form.email,
      phone: form.phone || null,
      date_of_birth: form.dateOfBirth || null,
      gender: form.gender || null,
      patron_category: form.patronCategory,
      faculty_code: facultyCode || null,
      faculty_name: form.faculty || null,
      department: form.department || null,
      level: form.level || null,
      programme: form.programme || null,
      matric_number: form.matricNumber || null,
      staff_id: form.staffId || null,
      rank: form.rank || null,
      status: 'active',
      membership_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });

    setLoading(false);
    if (dbErr) { setError('Account created but profile setup failed. Please contact the library.'); return; }
    navigate('/dashboard/library-card');
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold font-mono mx-auto mb-3"
            style={{ background: 'var(--color-primary)' }}
          >
            {institutionConfig.shortName.slice(0, 3)}
          </div>
          <h1 className="text-2xl font-serif font-semibold text-primary-800">
            Patron Registration
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {institutionConfig.name}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${step >= s ? 'text-white' : 'text-neutral-400 bg-neutral-200'}`}
                style={step >= s ? { background: 'var(--color-primary)' } : {}}
              >
                {s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-0.5 mx-1 transition-colors ${step > s ? 'bg-primary-600' : 'bg-neutral-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="card p-6">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-error-50 border border-error-200 text-error-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Personal info */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="font-semibold text-neutral-800 mb-4">Personal Information</h2>
                <div>
                  <label className="label">Full Name</label>
                  <input className="input" placeholder="As on ID card" value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input className="input" type="email" placeholder="your@email.com"
                    value={form.email} onChange={(e) => set('email', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input className="input" type="password" placeholder="Min 8 chars, 1 number, 1 special"
                    value={form.password} onChange={(e) => set('password', e.target.value)}
                    minLength={8} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" placeholder="+234…" value={form.phone}
                      onChange={(e) => set('phone', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Gender</label>
                    <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                      <option value="">Select…</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Date of Birth</label>
                  <input
                    className="input"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => set('dateOfBirth', e.target.value)}
                    max={new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    min={new Date(Date.now() - 100 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    placeholder="dd/mm/yyyy"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Use the calendar picker or type in YYYY-MM-DD format</p>
                </div>
                <button
                  type="button"
                  disabled={!form.fullName || !form.email || !form.password}
                  onClick={() => setStep(2)}
                  className="btn-primary w-full mt-2"
                >
                  Continue →
                </button>
              </div>
            )}

            {/* Step 2: Category */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="font-semibold text-neutral-800 mb-4">Patron Category</h2>
                <div>
                  <label className="label">I am a…</label>
                  <select className="input" value={form.patronCategory}
                    onChange={(e) => set('patronCategory', e.target.value)} required>
                    <option value="">Select category</option>
                    {patronCategories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {form.patronCategory && (
                  <>
                    <div>
                      <label className="label">Faculty</label>
                      <select className="input" value={form.faculty} onChange={(e) => set('faculty', e.target.value)} required>
                        <option value="">Select faculty</option>
                        {institutionConfig.faculties.map((f) => (
                          <option key={f.code}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Department</label>
                      <input className="input" placeholder="e.g. Department of Private Law"
                        value={form.department} onChange={(e) => set('department', e.target.value)} />
                    </div>

                    {isStudent && (
                      <>
                        <div>
                          <label className="label">Matriculation Number *</label>
                          <input className="input font-mono" placeholder={`${institutionConfig.institutionCode}/…`}
                            value={form.matricNumber} onChange={(e) => set('matricNumber', e.target.value)} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label">Level</label>
                            <select className="input" value={form.level} onChange={(e) => set('level', e.target.value)}>
                              <option value="">Select…</option>
                              {levels.map((l) => <option key={l}>{l}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label">Programme</label>
                            <input className="input" placeholder="e.g. LLB" value={form.programme}
                              onChange={(e) => set('programme', e.target.value)} />
                          </div>
                        </div>
                      </>
                    )}

                    {isStaff && (
                      <>
                        <div>
                          <label className="label">Staff ID *</label>
                          <input className="input font-mono" value={form.staffId}
                            onChange={(e) => set('staffId', e.target.value)} required />
                        </div>
                        <div>
                          <label className="label">Rank/Title</label>
                          <input className="input" placeholder="e.g. Senior Lecturer" value={form.rank}
                            onChange={(e) => set('rank', e.target.value)} />
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1">
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!form.patronCategory}
                    onClick={() => setStep(3)}
                    className="btn-primary flex-1"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="font-semibold text-neutral-800 mb-4">Confirm & Register</h2>
                <div className="bg-neutral-50 rounded-xl p-4 text-sm space-y-2">
                  {[
                    ['Name', form.fullName],
                    ['Email', form.email],
                    ['Category', form.patronCategory],
                    ['Faculty', form.faculty],
                    form.matricNumber && ['Matric No.', form.matricNumber],
                    form.staffId && ['Staff ID', form.staffId],
                  ].filter(Boolean).map(([k, v]: any) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-neutral-500">{k}</span>
                      <span className="font-medium text-neutral-800">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 p-3 bg-primary-50 rounded-xl">
                  <input type="checkbox" id="agree" required className="mt-0.5" />
                  <label htmlFor="agree" className="text-xs text-neutral-600 leading-relaxed">
                    I agree to the{' '}
                    <Link to="/terms" className="text-primary-600 hover:underline" target="_blank">
                      Terms of Use
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="text-primary-600 hover:underline" target="_blank">
                      Privacy Policy
                    </Link>
                    {' '}of {institutionConfig.name}.
                  </label>
                </div>

                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={() => setStep(2)} className="btn-ghost flex-1">
                    ← Back
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1">
                    {loading ? 'Registering…' : 'Create Account'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-neutral-500 mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-800 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
