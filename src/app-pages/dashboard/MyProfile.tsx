import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';
import { readProfilePhoto } from '@/components/auth/ProfilePhotoInput';
import { useI18n } from '@/lib/i18n';

interface ResearcherProfile {
  id: string;
  user_id: string;
  salutation: string;
  full_name: string;
  rank: string;
  employment_status: string;
  institutional_email: string;
  phone: string;
  office_location: string;
  highest_qualification: { degree: string; field: string; year: number } | null;
  specialisations: string[];
  research_keywords: string[];
  biography: string;
  orcid: string;
  orcid_verified: boolean;
  google_scholar_id: string;
  researchgate_url: string;
  profile_photo_url: string | null;
  status: 'draft' | 'pending' | 'approved';
}

export default function MyProfile() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [profile, setProfile] = useState<ResearcherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    salutation: '',
    full_name: '',
    rank: '',
    employment_status: '',
    institutional_email: '',
    phone: '',
    office_location: '',
    highest_qualification: { degree: '', field: '', year: new Date().getFullYear() },
    specialisations: ['', '', ''],
    research_keywords: ['', '', '', '', ''],
    biography: '',
    orcid: '',
    google_scholar_id: '',
    researchgate_url: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          void navigate('/login');
          return;
        }

        const { data: profileData, error } = await supabase
          .from('researcher_profiles')
          .select('*')
          .eq('user_id', userData.user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
          setPhotoUrl(profileData.profile_photo_url ?? null);
          setFormData({
            salutation: profileData.salutation || '',
            full_name: profileData.full_name || '',
            rank: profileData.rank || '',
            employment_status: profileData.employment_status || '',
            institutional_email: profileData.institutional_email || '',
            phone: profileData.phone || '',
            office_location: profileData.office_location || '',
            highest_qualification: profileData.highest_qualification || {
              degree: '',
              field: '',
              year: new Date().getFullYear(),
            },
            specialisations: profileData.specialisations || ['', '', ''],
            research_keywords: profileData.research_keywords || ['', '', '', '', ''],
            biography: profileData.biography || '',
            orcid: profileData.orcid || '',
            google_scholar_id: profileData.google_scholar_id || '',
            researchgate_url: profileData.researchgate_url || '',
          });
        } else if (error && error.code !== 'PGRST116') {
          throw error;
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQualificationChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      highest_qualification: {
        ...prev.highest_qualification,
        [field]: field === 'year' ? parseInt(value) : value,
      },
    }));
  };

  const handleArrayFieldChange = (
    field: 'specialisations' | 'research_keywords',
    index: number,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const dataUrl = await readProfilePhoto(file);
      setPhotoUrl(dataUrl);
      setProfile((prev) => (prev ? { ...prev, profile_photo_url: dataUrl } : prev));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Could not process that photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const filterEmptyStrings = (arr: string[]) => arr.filter((item) => item.trim() !== '');

      const upsertData = {
        user_id: userData.user.id,
        salutation: formData.salutation,
        full_name: formData.full_name,
        rank: formData.rank,
        employment_status: formData.employment_status,
        institutional_email: formData.institutional_email,
        phone: formData.phone,
        office_location: formData.office_location,
        highest_qualification: formData.highest_qualification,
        specialisations: filterEmptyStrings(formData.specialisations),
        research_keywords: filterEmptyStrings(formData.research_keywords),
        biography: formData.biography,
        orcid: formData.orcid,
        google_scholar_id: formData.google_scholar_id,
        researchgate_url: formData.researchgate_url,
        profile_photo_url: photoUrl,
        status: 'pending' as const,
      };

      const { data, error } = await supabase
        .from('researcher_profiles')
        .upsert([upsertData], { onConflict: 'user_id' })
        .select();

      if (error) throw error;

      setProfile(data[0]);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('profile.loadingProfile')}</p>
        </div>
      </div>
    );
  }

  const bioWordCount = formData.biography.trim().split(/\s+/).length;
  const bioValid = bioWordCount >= 200 && bioWordCount <= 500;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <BackButton label={t('common.back')} />
            <h1 className="text-4xl font-bold text-gray-900">{t('profile.researchProfile')}</h1>
            <p className="text-gray-600 mt-2">
              {t('profile.manageResearcherProfile')}
            </p>
          </div>
          {profile && (
            <span
              className={`badge px-4 py-2 rounded-full text-sm font-semibold ${
                profile.status === 'approved'
                  ? 'badge-success'
                  : profile.status === 'pending'
                    ? 'badge-warning'
                    : 'badge-secondary'
              }`}
            >
              {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.profilePhoto')}</h2>
            <div className="flex gap-6 items-start">
              <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={t('profile.profilePhoto')}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">📸</span>
                )}
              </div>
              <div className="flex-1">
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.uploadPhoto')}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="input w-full text-sm text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {t('profile.photoHint')}
                </p>
                {photoError && <p className="text-xs text-red-600 mt-2">{photoError}</p>}
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.personalInformation')}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.salutation')}
                </label>
                <select
                  name="salutation"
                  value={formData.salutation}
                  onChange={handleInputChange}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('profile.selectPlaceholder')}</option>
                  <option value="Dr">{t('profile.dr')}</option>
                  <option value="Prof">{t('profile.prof')}</option>
                  <option value="Ms">{t('profile.ms')}</option>
                  <option value="Mr">{t('profile.mr')}</option>
                  <option value="Mrs">{t('profile.mrs')}</option>
                </select>
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.fullName')}
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.academicRank')}
                </label>
                <input
                  type="text"
                  name="rank"
                  value={formData.rank}
                  onChange={handleInputChange}
                  placeholder={t('profile.rankPlaceholder')}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.employmentStatus')}
                </label>
                <select
                  name="employment_status"
                  value={formData.employment_status}
                  onChange={handleInputChange}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('profile.selectPlaceholder')}</option>
                  <option value="Full-time">{t('profile.fullTime')}</option>
                  <option value="Part-time">{t('profile.partTime')}</option>
                  <option value="Contract">{t('profile.contract')}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.contactInformation')}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.institutionalEmail')}
                </label>
                <input
                  type="email"
                  name="institutional_email"
                  value={formData.institutional_email}
                  onChange={handleInputChange}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.phone')}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.officeLocation')}
                </label>
                <input
                  type="text"
                  name="office_location"
                  value={formData.office_location}
                  onChange={handleInputChange}
                  placeholder={t('profile.officePlaceholder')}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.qualifications')}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.degree')}
                </label>
                <input
                  type="text"
                  value={formData.highest_qualification.degree}
                  onChange={(e) => handleQualificationChange('degree', e.target.value)}
                  placeholder={t('profile.degreePlaceholder')}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.field')}
                </label>
                <input
                  type="text"
                  value={formData.highest_qualification.field}
                  onChange={(e) => handleQualificationChange('field', e.target.value)}
                  placeholder={t('profile.fieldPlaceholder')}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.year')}
                </label>
                <input
                  type="number"
                  value={formData.highest_qualification.year}
                  onChange={(e) => handleQualificationChange('year', e.target.value)}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.specialisations')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('profile.maxSpecialisations')}</p>
            <div className="space-y-3">
              {formData.specialisations.map((spec, index) => (
                <input
                  key={index}
                  type="text"
                  value={spec}
                  onChange={(e) => handleArrayFieldChange('specialisations', index, e.target.value)}
                  placeholder={t('profile.specialisation', { index: index + 1 })}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.researchKeywords')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('profile.minKeywords')}</p>
            <div className="space-y-3">
              {formData.research_keywords.map((keyword, index) => (
                <input
                  key={index}
                  type="text"
                  value={keyword}
                  onChange={(e) => handleArrayFieldChange('research_keywords', index, e.target.value)}
                  placeholder={t('profile.keyword', { index: index + 1 })}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.biography')}</h2>
            <div className="mb-3">
              <label className="label block text-sm font-semibold text-gray-700 mb-2">
                {t('profile.professionalBiography')}
              </label>
              <p className="text-xs text-gray-600 mb-2">{t('profile.wordCountHint')}</p>
              <textarea
                name="biography"
                value={formData.biography}
                onChange={handleInputChange}
                placeholder={t('profile.bioPlaceholder')}
                className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={5}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                {t('profile.wordsCount', { count: bioWordCount })}
              </span>
              <span className={bioValid ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
                {bioValid ? t('profile.valid') : t('profile.bioRequired')}
              </span>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.academicIds')}</h2>
            <div className="space-y-4">
              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.orcid')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="orcid"
                    value={formData.orcid}
                    onChange={handleInputChange}
                    placeholder={t('profile.orcidPlaceholder')}
                    className="input flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.orcid && (
                    <button
                      type="button"
                      className="btn-outline px-4 py-2 rounded font-semibold"
                    >
                      {t('profile.verify')}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.googleScholarId')}
                </label>
                <input
                  type="text"
                  name="google_scholar_id"
                  value={formData.google_scholar_id}
                  onChange={handleInputChange}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.researchGateUrl')}
                </label>
                <input
                  type="url"
                  name="researchgate_url"
                  value={formData.researchgate_url}
                  onChange={handleInputChange}
                  placeholder={t('profile.researchGatePlaceholder')}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !bioValid}
              className="btn-primary flex-1 px-4 py-3 rounded font-semibold disabled:opacity-50"
            >
              {saving ? t('profile.saving') : t('profile.submitForReview')}
            </button>
            <a href="/dashboard" className="btn-outline flex-1 px-4 py-3 rounded font-semibold text-center">
              {t('profile.cancel')}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
