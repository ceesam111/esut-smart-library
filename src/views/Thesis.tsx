import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface ThesisStats {
  totalPublished: number;
  byFaculty: Array<{ faculty: string; count: number }>;
}

export default function Thesis() {
  const [stats, setStats] = useState<ThesisStats>({
    totalPublished: 0,
    byFaculty: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: thesesData, error } = await supabase
        .from('theses')
        .select('faculty')
        .eq('status', 'published');

      if (error) throw error;

      const totalPublished = thesesData?.length || 0;
      const byFacultyMap = new Map<string, number>();

      thesesData?.forEach((thesis) => {
        const faculty = thesis.faculty || 'Other';
        byFacultyMap.set(faculty, (byFacultyMap.get(faculty) || 0) + 1);
      });

      const byFaculty = Array.from(byFacultyMap.entries())
        .map(([faculty, count]) => ({ faculty, count }))
        .sort((a, b) => b.count - a.count);

      setStats({ totalPublished, byFaculty });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <section className="bg-gradient-to-r from-primary-700 to-primary-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Institutional Thesis Portal</h1>
          <p className="text-lg mb-6">
            Preserve, share, and celebrate the scholarly achievements of our postgraduate research community.
            Submit your thesis to {institutionConfig.name} and make your research accessible to the world.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/thesis/submit" className="btn-primary">
              Submit Thesis
            </Link>
            <Link to="/thesis/status" className="btn-outline">
              Check Status
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="text-3xl font-bold mb-8 text-center">Submission Process</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="card text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              1
            </div>
            <h3 className="font-semibold mb-2">Submit</h3>
            <p className="text-sm text-gray-600">
              Complete the submission form with your thesis details and upload your PDF
            </p>
          </div>

          <div className="card text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              2
            </div>
            <h3 className="font-semibold mb-2">Supervisor Review</h3>
            <p className="text-sm text-gray-600">
              Your primary supervisor reviews and approves your submission
            </p>
          </div>

          <div className="card text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              3
            </div>
            <h3 className="font-semibold mb-2">Faculty Committee</h3>
            <p className="text-sm text-gray-600">
              Faculty committee reviews and provides final approval
            </p>
          </div>

          <div className="card text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              4
            </div>
            <h3 className="font-semibold mb-2">Published</h3>
            <p className="text-sm text-gray-600">
              Your thesis is catalogued and made publicly available
            </p>
          </div>
        </div>
      </section>

      <section className="section bg-gray-50 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-8 text-center">Portal Statistics</h2>

        {loading ? (
          <div className="text-center py-8">Loading statistics...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card text-center">
              <p className="text-gray-500 text-sm mb-2">Total Published Theses</p>
              <p className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {stats.totalPublished}
              </p>
            </div>

            <div className="md:col-span-2 card">
              <h3 className="font-semibold mb-4">Theses by Faculty</h3>
              <div className="space-y-3">
                {stats.byFaculty.length === 0 ? (
                  <p className="text-gray-600 text-sm">No published theses yet.</p>
                ) : (
                  stats.byFaculty.map((item) => (
                    <div key={item.faculty} className="flex items-center">
                      <span className="w-32 text-sm font-medium">{item.faculty}</span>
                      <div className="flex-1 h-8 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            backgroundColor: 'var(--color-primary)',
                            width: `${(item.count / (Math.max(...stats.byFaculty.map((f) => f.count)) || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm font-semibold">
                        {item.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="text-2xl font-bold mb-6">About the Thesis Portal</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                ✓
              </span>
              For Researchers
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>Permanent digital preservation of your scholarly work</li>
              <li>Increased visibility and impact for your research</li>
              <li>Structured metadata for easy discovery</li>
              <li>DOI registration for academic citation</li>
            </ul>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                ✓
              </span>
              For the Institution
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>Showcase institutional research excellence</li>
              <li>Support open access and knowledge sharing</li>
              <li>Streamline thesis approval workflows</li>
              <li>Comprehensive institutional repository</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section bg-primary-50 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Submit?</h2>
        <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
          Contact the library for submission guidelines, acceptable file formats, and if you need any assistance with the submission process.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/thesis/submit" className="btn-primary">
            Start Submission
          </Link>
          <a href={`mailto:library@${institutionConfig.shortName}.edu`} className="btn-outline">
            Contact Library
          </a>
        </div>
      </section>
    </div>
  );
}
