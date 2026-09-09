import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

type FormatType = 'Book' | 'Journal Article' | 'Conference Paper' | 'Thesis/Dissertation' | 'Report' | 'Other';

interface FormState {
  item_title: string;
  authors: string;
  publisher: string;
  year_of_publication: string;
  isbn_issn: string;
  format_type: FormatType | '';
  reason: string;
  urgency: 'Normal' | 'Urgent' | '';
  from_library: string;
  notes: string;
}

const blank: FormState = {
  item_title: '',
  authors: '',
  publisher: '',
  year_of_publication: '',
  isbn_issn: '',
  format_type: '',
  reason: '',
  urgency: 'Normal',
  from_library: '',
  notes: '',
};

function requestTypeForFormat(format: FormatType | '') {
  if (format === 'Journal Article' || format === 'Conference Paper') return 'article';
  if (format === 'Report' || format === 'Other') return 'copy';
  return 'borrow';
}

export default function ILLRequest() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(blank);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patronId, setPatronId] = useState<string | null>(null);
  const [patronName, setPatronName] = useState<string>('');
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate('/login?redirect=/catalogue/ill-request');
        return;
      }

      const { data: patron } = await supabase
        .from('patrons')
        .select('id, full_name')
        .eq('user_id', userData.user.id)
        .single();

      if (patron) {
        setPatronId(patron.id);
        setPatronName(patron.full_name);
      }
      setLoadingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  const set = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.item_title.trim()) {
      setError('Item title is required.');
      return;
    }
    if (!form.format_type) {
      setError('Please select the item type.');
      return;
    }
    if (!form.reason.trim()) {
      setError('Please provide a reason for the request.');
      return;
    }
    if (!patronId) {
      setError('Your patron account was not found. Please contact the library.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from('ill_requests').insert({
        patron_id: patronId,
        title: form.item_title.trim(),
        author: form.authors.trim() || null,
        publisher: form.publisher.trim() || null,
        year: form.year_of_publication ? form.year_of_publication.toString() : null,
        isbn: form.isbn_issn.trim() || null,
        request_type: requestTypeForFormat(form.format_type),
        notes: [
          form.reason.trim() ? `Reason: ${form.reason.trim()}` : '',
          form.urgency ? `Urgency: ${form.urgency}` : '',
          form.from_library.trim() ? `Suggested Library: ${form.from_library.trim()}` : '',
          form.notes.trim() ? `Notes: ${form.notes.trim()}` : ''
        ].filter(Boolean).join(' | '),
        status: 'pending',
      });

      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message ?? 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="section">
            <h1>Inter-Library Loan Request</h1>
          </div>
        </div>
        <div className="section py-16 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center text-3xl">✓</div>
          <h2 className="text-2xl font-bold text-neutral-800">Request Submitted!</h2>
          <p className="text-neutral-600 max-w-md">
            Your ILL request has been received. The library team will review it and contact you about availability.
            You can track your request status from your dashboard.
          </p>
          <div className="flex gap-3">
            <Link to="/dashboard/ill" className="btn-primary">View My ILL Requests</Link>
            <button onClick={() => { setForm(blank); setSubmitted(false); }} className="btn-outline">
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="section">
          <h1>Inter-Library Loan Request</h1>
          <p className="text-white/80 mt-2">
            Request materials not held in the {institutionConfig.libraryName} collection from partner libraries.
          </p>
        </div>
      </div>

      <div className="section py-10">
        <div className="max-w-2xl mx-auto">
          <div className="card p-6 sm:p-8 space-y-6">
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800">
              <strong>Submitting as:</strong> {patronName || 'Loading...'}<br />
              ILL requests are typically fulfilled within 5–10 working days.
            </div>

            {error && (
              <div className="p-4 bg-error-50 border border-error-200 rounded-lg text-sm text-error-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Item Information */}
              <div>
                <h3 className="font-semibold text-neutral-800 mb-4 pb-2 border-b border-neutral-100">
                  Item Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Item Title <span className="text-error-500">*</span></label>
                    <input
                      className="input"
                      placeholder="Full title of the book, article, or resource"
                      value={form.item_title}
                      onChange={(e) => set('item_title', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Author(s)</label>
                    <input
                      className="input"
                      placeholder="e.g. Smith, J. & Doe, A."
                      value={form.authors}
                      onChange={(e) => set('authors', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Publisher</label>
                      <input
                        className="input"
                        placeholder="Publisher name"
                        value={form.publisher}
                        onChange={(e) => set('publisher', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Year of Publication</label>
                      <input
                        className="input"
                        type="number"
                        placeholder="e.g. 2022"
                        min={1900}
                        max={new Date().getFullYear() + 1}
                        value={form.year_of_publication}
                        onChange={(e) => set('year_of_publication', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">ISBN / ISSN</label>
                      <input
                        className="input font-mono"
                        placeholder="978-XXXXXXXXXX or XXXX-XXXX"
                        value={form.isbn_issn}
                        onChange={(e) => set('isbn_issn', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Item Type <span className="text-error-500">*</span></label>
                      <select
                        className="input"
                        value={form.format_type}
                        onChange={(e) => set('format_type', e.target.value)}
                        required
                      >
                        <option value="">Select type…</option>
                        {(['Book', 'Journal Article', 'Conference Paper', 'Thesis/Dissertation', 'Report', 'Other'] as FormatType[]).map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label">Suggested Source Library (if known)</label>
                    <input
                      className="input"
                      placeholder="e.g. University of Lagos Library"
                      value={form.from_library}
                      onChange={(e) => set('from_library', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Request Details */}
              <div>
                <h3 className="font-semibold text-neutral-800 mb-4 pb-2 border-b border-neutral-100">
                  Request Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Reason for Request <span className="text-error-500">*</span></label>
                    <textarea
                      className="input resize-none"
                      rows={3}
                      placeholder="Briefly explain why you need this item (e.g. for a research project, course assignment, etc.)"
                      value={form.reason}
                      onChange={(e) => set('reason', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Urgency</label>
                    <select
                      className="input"
                      value={form.urgency}
                      onChange={(e) => set('urgency', e.target.value as 'Normal' | 'Urgent')}
                    >
                      <option value="Normal">Normal (5–10 working days)</option>
                      <option value="Urgent">Urgent (please explain in notes)</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Additional Notes</label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      placeholder="Any other information that may help us locate the item"
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Link to="/dashboard/ill" className="btn-ghost flex-1 text-center">
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit ILL Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
