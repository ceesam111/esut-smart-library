import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';

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
          navigate('/login');
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

    fetchProfile();
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
    if (!file.type.startsWith('image/') || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setPhotoError('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    const minBytes = 50 * 1024;
    const maxBytes = 240 * 1024;

    if (file.size < minBytes) {
      setPhotoError(`Photo is too small (${Math.round(file.size / 1024)} KB). Minimum size is 50 KB.`);
      return;
    }
    if (file.size > maxBytes) {
      setPhotoError(`Photo is too large (${Math.round(file.size / 1024)} KB). Maximum size is 240 KB.`);
      return;
    }

    setUploadingPhoto(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read selected image.'));
        reader.readAsDataURL(file);
      });
      setPhotoUrl(dataUrl);
      setProfile((prev) => (prev ? { ...prev, profile_photo_url: dataUrl } : prev));
    } catch (error) {
      console.error('Error uploading photo:', error);
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
          <p className="text-gray-600">Loading profile...</p>
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
            <BackButton />
            <h1 className="text-4xl font-bold text-gray-900">Research Profile</h1>
            <p className="text-gray-600 mt-2">
              Manage your academic researcher profile
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Photo</h2>
            <div className="flex gap-6 items-start">
              <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">📸</span>
                )}
              </div>
              <div className="flex-1">
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Upload Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="input w-full text-sm text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-2">
                  JPG, PNG, or WebP (50KB - 240KB)
                </p>
                {photoError && <p className="text-xs text-red-600 mt-2">{photoError}</p>}
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Personal Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Salutation
                </label>
                <select
                  name="salutation"
                  value={formData.salutation}
                  onChange={handleInputChange}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Dr">Dr</option>
                  <option value="Prof">Prof</option>
                  <option value="Ms">Ms</option>
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                </select>
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
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
                  Academic Rank
                </label>
                <input
                  type="text"
                  name="rank"
                  value={formData.rank}
                  onChange={handleInputChange}
                  placeholder="e.g., Senior Lecturer"
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Employment Status
                </label>
                <select
                  name="employment_status"
                  value={formData.employment_status}
                  onChange={handleInputChange}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Institutional Email
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
                  Phone
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
                  Office Location
                </label>
                <input
                  type="text"
                  name="office_location"
                  value={formData.office_location}
                  onChange={handleInputChange}
                  placeholder="e.g., Science Building, Room 201"
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Qualifications</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Degree
                </label>
                <input
                  type="text"
                  value={formData.highest_qualification.degree}
                  onChange={(e) => handleQualificationChange('degree', e.target.value)}
                  placeholder="e.g., PhD"
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Field
                </label>
                <input
                  type="text"
                  value={formData.highest_qualification.field}
                  onChange={(e) => handleQualificationChange('field', e.target.value)}
                  placeholder="e.g., Physics"
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Year
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Specialisations</h2>
            <p className="text-sm text-gray-600 mb-4">Maximum 3 specialisations</p>
            <div className="space-y-3">
              {formData.specialisations.map((spec, index) => (
                <input
                  key={index}
                  type="text"
                  value={spec}
                  onChange={(e) => handleArrayFieldChange('specialisations', index, e.target.value)}
                  placeholder={`Specialisation ${index + 1}`}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Research Keywords</h2>
            <p className="text-sm text-gray-600 mb-4">Minimum 5 keywords</p>
            <div className="space-y-3">
              {formData.research_keywords.map((keyword, index) => (
                <input
                  key={index}
                  type="text"
                  value={keyword}
                  onChange={(e) => handleArrayFieldChange('research_keywords', index, e.target.value)}
                  placeholder={`Keyword ${index + 1}`}
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Biography</h2>
            <div className="mb-3">
              <label className="label block text-sm font-semibold text-gray-700 mb-2">
                Professional Biography
              </label>
              <p className="text-xs text-gray-600 mb-2">200-500 words</p>
              <textarea
                name="biography"
                value={formData.biography}
                onChange={handleInputChange}
                placeholder="Write your professional biography..."
                className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={5}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">
                {bioWordCount} words
              </span>
              <span className={bioValid ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
                {bioValid ? '✓ Valid' : '⚠ 200-500 words required'}
              </span>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Academic IDs</h2>
            <div className="space-y-4">
              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  ORCID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="orcid"
                    value={formData.orcid}
                    onChange={handleInputChange}
                    placeholder="e.g., 0000-0001-2345-6789"
                    className="input flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.orcid && (
                    <button
                      type="button"
                      className="btn-outline px-4 py-2 rounded font-semibold"
                    >
                      Verify
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Google Scholar ID
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
                  ResearchGate URL
                </label>
                <input
                  type="url"
                  name="researchgate_url"
                  value={formData.researchgate_url}
                  onChange={handleInputChange}
                  placeholder="https://researchgate.net/profile/..."
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
              {saving ? 'Saving...' : 'Submit for Review'}
            </button>
            <a href="/dashboard" className="btn-outline flex-1 px-4 py-3 rounded font-semibold text-center">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
