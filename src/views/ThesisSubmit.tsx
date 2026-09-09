import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface FormData {
  title: string;
  abstract: string;
  degree_programme: string;
  academic_session: string;
  supervisor_ids: string[];
  keywords: string[];
  subject_classification: string;
  embargo_enabled: boolean;
  embargo_period_months: number;
  file: File | null;
  declaration_accepted: boolean;
}

export default function ThesisSubmit() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    abstract: '',
    degree_programme: '',
    academic_session: '',
    supervisor_ids: [],
    keywords: [],
    subject_classification: '',
    embargo_enabled: false,
    embargo_period_months: 6,
    file: null,
    declaration_accepted: false,
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [supervisorInput, setSupervisorInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const degreeOptions = ['Ph.D.', 'M.Phil.', 'M.Sc.', 'M.A.', 'MBA', 'LLM', 'B.Sc. Project'];

  const subjectClassifications = [
    'Science & Technology',
    'Engineering',
    'Medicine & Health',
    'Social Sciences',
    'Humanities',
    'Business & Management',
    'Law',
    'Agriculture',
  ];

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, keywordInput.trim()],
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((k) => k !== keyword),
    });
  };

  const addSupervisor = () => {
    if (supervisorInput.trim() && formData.supervisor_ids.length < 3) {
      setFormData({
        ...formData,
        supervisor_ids: [...formData.supervisor_ids, supervisorInput.trim()],
      });
      setSupervisorInput('');
    }
  };

  const removeSupervisor = (supervisor: string) => {
    setFormData({
      ...formData,
      supervisor_ids: formData.supervisor_ids.filter((s) => s !== supervisor),
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are accepted.');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError('File size must not exceed 100MB.');
        return;
      }
      setError('');
      setFormData({ ...formData, file });
    }
  };

  const validateStep = () => {
    if (currentStep === 1) {
      if (!formData.title.trim()) {
        setError('Title is required.');
        return false;
      }
      if (formData.abstract.length < 250 || formData.abstract.length > 350) {
        setError('Abstract must be between 250 and 350 words.');
        return false;
      }
      if (!formData.degree_programme) {
        setError('Degree programme is required.');
        return false;
      }
      if (!formData.academic_session.trim()) {
        setError('Academic session is required.');
        return false;
      }
    } else if (currentStep === 2) {
      if (formData.supervisor_ids.length === 0) {
        setError('At least one supervisor is required.');
        return false;
      }
      if (formData.keywords.length < 5) {
        setError('At least 5 keywords are required.');
        return false;
      }
      if (!formData.subject_classification) {
        setError('Subject classification is required.');
        return false;
      }
    } else if (currentStep === 3) {
      if (!formData.file) {
        setError('Thesis file is required.');
        return false;
      }
      if (!formData.declaration_accepted) {
        setError('You must accept the declaration to submit.');
        return false;
      }
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;

    setLoading(true);
    try {
      let file_url = null;

      if (formData.file) {
        const fileName = `${Date.now()}-${formData.file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('theses')
          .upload(`submissions/${fileName}`, formData.file);

        if (uploadError) throw uploadError;
        file_url = uploadData?.path;
      }

      const { error: insertError } = await supabase.from('theses').insert([
        {
          title: formData.title,
          abstract: formData.abstract,
          degree_programme: formData.degree_programme,
          academic_session: formData.academic_session,
          supervisors: formData.supervisor_ids,
          keywords: formData.keywords,
          subject_classification: formData.subject_classification,
          embargo_enabled: formData.embargo_enabled,
          embargo_period_months: formData.embargo_period_months,
          file_url,
          status: 'submitted',
          created_at: new Date(),
        },
      ]);

      if (insertError) throw insertError;

      setLoading(false);
      navigate('/thesis/status', {
        state: { message: 'Thesis submitted successfully!' },
      });
    } catch (err) {
      console.error('Error submitting thesis:', err);
      setError('Error submitting thesis. Please try again.');
      setLoading(false);
    }
  };

  const wordCount = formData.abstract.split(/\s+/).filter((w) => w.length > 0).length;
  const wordCountColor = wordCount < 250 || wordCount > 350 ? 'text-red-600' : 'text-green-600';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Thesis Submission</h1>
        <p>Submit your postgraduate thesis to {institutionConfig.name}</p>
      </div>

      <section className="section max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    step <= currentStep ? 'bg-primary-700' : 'bg-gray-300'
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-primary-700' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Basic Information</span>
            <span>Supervision & Keywords</span>
            <span>Upload & Declaration</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {currentStep === 1 && (
            <div className="space-y-6 card">
              <h2 className="text-2xl font-bold">Step 1: Basic Information</h2>

              {error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              <div>
                <label className="label">Thesis Title</label>
                <input
                  type="text"
                  className="input"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter your thesis title"
                />
              </div>

              <div>
                <label className="label">
                  Abstract ({wordCount} words, required: 250-350)
                </label>
                <textarea
                  className="input"
                  rows={6}
                  value={formData.abstract}
                  onChange={(e) =>
                    setFormData({ ...formData, abstract: e.target.value })
                  }
                  placeholder="Enter your thesis abstract"
                />
                <p className={`text-sm mt-1 ${wordCountColor}`}>
                  Word count: {wordCount}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Degree Programme</label>
                  <select
                    className="input"
                    value={formData.degree_programme}
                    onChange={(e) =>
                      setFormData({ ...formData, degree_programme: e.target.value })
                    }
                  >
                    <option value="">Select Programme</option>
                    {degreeOptions.map((degree) => (
                      <option key={degree} value={degree}>
                        {degree}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Academic Session</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.academic_session}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        academic_session: e.target.value,
                      })
                    }
                    placeholder="e.g., 2023/2024"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 card">
              <h2 className="text-2xl font-bold">Step 2: Supervision & Keywords</h2>

              {error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              <div>
                <label className="label">Supervisors (Maximum 3)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="input flex-1"
                    value={supervisorInput}
                    onChange={(e) => setSupervisorInput(e.target.value)}
                    placeholder="Supervisor name or ID"
                    disabled={formData.supervisor_ids.length >= 3}
                  />
                  <button
                    type="button"
                    onClick={addSupervisor}
                    disabled={formData.supervisor_ids.length >= 3}
                    className="btn-primary"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.supervisor_ids.map((supervisor) => (
                    <div
                      key={supervisor}
                      className="badge badge-primary flex items-center gap-2"
                    >
                      {supervisor}
                      <button
                        type="button"
                        onClick={() => removeSupervisor(supervisor)}
                        className="font-bold hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Keywords (Minimum 5)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="input flex-1"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="Type keyword and press Enter or click Add"
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="btn-primary"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map((keyword) => (
                    <div key={keyword} className="badge flex items-center gap-2">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                        className="font-bold hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Subject Classification</label>
                <select
                  className="input"
                  value={formData.subject_classification}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      subject_classification: e.target.value,
                    })
                  }
                >
                  <option value="">Select Subject</option>
                  {subjectClassifications.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 card">
              <h2 className="text-2xl font-bold">Step 3: Upload & Declaration</h2>

              {error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              <div>
                <label className="label">Upload Thesis PDF (Max 100MB)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="input"
                  onChange={handleFileChange}
                />
                {formData.file && (
                  <p className="text-sm text-green-600 mt-2">
                    Selected: {formData.file.name}
                  </p>
                )}
              </div>

              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.embargo_enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        embargo_enabled: e.target.checked,
                      })
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold">Apply Embargo Period</span>
                    <p className="text-sm text-gray-600 mt-1">
                      Delay public access to your thesis for a specified period
                    </p>
                  </span>
                </label>

                {formData.embargo_enabled && (
                  <div className="mt-4 ml-8">
                    <label className="label">Embargo Period (months)</label>
                    <select
                      className="input"
                      value={formData.embargo_period_months}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          embargo_period_months: parseInt(e.target.value),
                        })
                      }
                    >
                      <option value={6}>6 months</option>
                      <option value={12}>12 months</option>
                      <option value={24}>24 months</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="bg-primary-50 p-4 rounded border border-primary-200">
                <h3 className="font-semibold mb-3">Declaration</h3>
                <p className="text-sm text-gray-700 mb-4">
                  I declare that this thesis is my own original work and has not been
                  previously submitted for any award. I confirm that all sources have
                  been properly acknowledged and all required permissions have been
                  obtained.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.declaration_accepted}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        declaration_accepted: e.target.checked,
                      })
                    }
                    className="mt-1"
                  />
                  <span className="text-sm">
                    I confirm that I have read and accept the above declaration
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="btn-outline flex-1"
              >
                Previous
              </button>
            )}
            {currentStep < 3 && (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary flex-1"
              >
                Next
              </button>
            )}
            {currentStep === 3 && (
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Submitting...' : 'Submit Thesis'}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
