import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';

interface PatronProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  faculty_name: string | null;
  department: string | null;
  patron_category: string;
  patron_id: string;
  matric_number: string | null;
  staff_id: string | null;
  current_level: string | null;
  programme: string | null;
  preferred_branch: string | null;
  research_interests: string[] | null;
  short_bio: string | null;
}

export default function PatronProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PatronProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    preferred_branch: '',
    research_interests: ['', '', ''],
    short_bio: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          navigate('/login');
          return;
        }

        const { data: patronData, error } = await supabase
          .from('patrons')
          .select('*')
          .eq('user_id', userData.user.id)
          .single();

        if (error) throw error;
        if (patronData) {
          setProfile(patronData);
          setFormData({
            phone: patronData.phone || '',
            preferred_branch: patronData.preferred_branch || '',
            research_interests: patronData.research_interests?.length
              ? [...patronData.research_interests, ...Array(3 - patronData.research_interests.length).fill('')].slice(0, 3)
              : ['', '', ''],
            short_bio: patronData.short_bio || '',
          });
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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleResearchInterestChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      research_interests: prev.research_interests.map((item, i) => (i === index ? value : item)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('patrons')
        .update({
          phone: formData.phone || null,
          preferred_branch: formData.preferred_branch || null,
          research_interests: formData.research_interests.filter((i) => i.trim() !== ''),
          short_bio: formData.short_bio || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <BackButton />
          <h1 className="text-4xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-2">Update your contact information and preferences</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 font-medium">Profile updated successfully!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Account Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={profile?.full_name || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patron ID</label>
                <input
                  type="text"
                  value={profile?.patron_id || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={profile?.patron_category?.replace('_', ' ') || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 capitalize"
                />
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Academic Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
                <input
                  type="text"
                  value={profile?.faculty_name || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={profile?.department || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              {profile?.matric_number && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Matric Number</label>
                  <input
                    type="text"
                    value={profile.matric_number}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 font-mono"
                  />
                </div>
              )}
              {profile?.staff_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID</label>
                  <input
                    type="text"
                    value={profile.staff_id}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 font-mono"
                  />
                </div>
              )}
              {profile?.current_level && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <input
                    type="text"
                    value={profile.current_level}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
              )}
              {profile?.programme && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Programme</label>
                  <input
                    type="text"
                    value={profile.programme}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact & Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="e.g., +234 801 234 5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Branch</label>
                <select
                  name="preferred_branch"
                  value={formData.preferred_branch}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">No preference</option>
                  <option value="main">Main Library</option>
                  <option value="science">Science Library</option>
                  <option value="engineering">Engineering Library</option>
                  <option value="medical">Medical Library</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Research Interests</h2>
            <p className="text-sm text-gray-600 mb-4">Optional. Up to 3 areas of research interest.</p>
            <div className="space-y-3">
              {formData.research_interests.map((interest, index) => (
                <input
                  key={index}
                  type="text"
                  value={interest}
                  onChange={(e) => handleResearchInterestChange(index, e.target.value)}
                  placeholder={`Research interest ${index + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              ))}
            </div>
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Short Bio</h2>
            <p className="text-sm text-gray-600 mb-4">Optional. A brief description about yourself (max 500 characters).</p>
            <textarea
              name="short_bio"
              value={formData.short_bio}
              onChange={handleInputChange}
              placeholder="Tell us about yourself..."
              maxLength={500}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-2 text-right">
              {formData.short_bio.length}/500
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <a
              href="/dashboard"
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold text-center hover:bg-gray-50"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
