import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ReadingList {
  id: string;
  course_code: string;
  title: string;
  faculty: string;
  lecturer_name: string;
  item_count: number;
  items_with_low_copies: number;
  usage_count: number;
  short_loan_enabled: boolean;
}

export default function CourseReserves() {
  const [readingLists, setReadingLists] = useState<ReadingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchReadingLists();
  }, []);

  const fetchReadingLists = async () => {
    try {
      const mockData: ReadingList[] = [
        {
          id: '1',
          course_code: 'CS101',
          title: 'Introduction to Computer Science',
          faculty: 'Faculty of Science',
          lecturer_name: 'Dr. Ahmed Hassan',
          item_count: 24,
          items_with_low_copies: 3,
          usage_count: 156,
          short_loan_enabled: true,
        },
        {
          id: '2',
          course_code: 'BIO201',
          title: 'Advanced Biology and Genetics',
          faculty: 'Faculty of Science',
          lecturer_name: 'Prof. Zainab Okafor',
          item_count: 18,
          items_with_low_copies: 2,
          usage_count: 89,
          short_loan_enabled: true,
        },
        {
          id: '3',
          course_code: 'ENG105',
          title: 'English Literature and Composition',
          faculty: 'Faculty of Arts',
          lecturer_name: 'Dr. Chioma Obi',
          item_count: 31,
          items_with_low_copies: 5,
          usage_count: 234,
          short_loan_enabled: false,
        },
        {
          id: '4',
          course_code: 'ENG301',
          title: 'Advanced Technical Engineering',
          faculty: 'Faculty of Engineering',
          lecturer_name: 'Prof. Kunle Enugu',
          item_count: 27,
          items_with_low_copies: 4,
          usage_count: 167,
          short_loan_enabled: true,
        },
        {
          id: '5',
          course_code: 'LAW202',
          title: 'Constitutional Law Principles',
          faculty: 'Faculty of Law',
          lecturer_name: 'Dr. Emeka Nwosu',
          item_count: 22,
          items_with_low_copies: 1,
          usage_count: 143,
          short_loan_enabled: true,
        },
      ];

      setReadingLists(mockData);
    } catch (error) {
      console.error('Error fetching reading lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleShortLoan = async (id: string, currentStatus: boolean) => {
    try {
      setReadingLists((prev) =>
        prev.map((list) =>
          list.id === id ? { ...list, short_loan_enabled: !currentStatus } : list
        )
      );
      console.log('Short loan toggled for:', id);
    } catch (error) {
      console.error('Error updating short loan status:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading course reserves...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reference Services Management</h1>
        <p className="text-gray-600 mt-2">Manage reading lists and course materials</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-primary-50 rounded">
            <p className="text-sm text-gray-600">Total Reading Lists</p>
            <p className="text-3xl font-bold text-primary-700 mt-2">{readingLists.length}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded">
            <p className="text-sm text-gray-600">Lists with Low Copies</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">
              {readingLists.filter((l) => l.items_with_low_copies > 0).length}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded">
            <p className="text-sm text-gray-600">Short Loan Enabled</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {readingLists.filter((l) => l.short_loan_enabled).length}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded">
            <p className="text-sm text-gray-600">Total Uses</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {readingLists.reduce((sum, l) => sum + l.usage_count, 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left p-3 font-semibold">Course Code</th>
              <th className="text-left p-3 font-semibold">Title</th>
              <th className="text-left p-3 font-semibold">Faculty</th>
              <th className="text-left p-3 font-semibold">Lecturer</th>
              <th className="text-left p-3 font-semibold">Items</th>
              <th className="text-left p-3 font-semibold">Low Copies</th>
              <th className="text-left p-3 font-semibold">Uses</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {readingLists.map((list) => (
              <tr key={list.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-semibold">{list.course_code}</td>
                <td className="p-3 font-medium">{list.title}</td>
                <td className="p-3">{list.faculty}</td>
                <td className="p-3">{list.lecturer_name}</td>
                <td className="p-3">
                  <span className="badge badge-primary">{list.item_count}</span>
                </td>
                <td className="p-3">
                  {list.items_with_low_copies > 0 ? (
                    <span className="badge badge-warning">{list.items_with_low_copies}</span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="p-3">{list.usage_count}</td>
                <td className="p-3">
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === list.id ? null : list.id)
                    }
                    className="btn-outline text-xs py-1 px-2"
                  >
                    {expandedId === list.id ? 'Hide' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expandedId && (
        <div className="card">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-semibold">
                {readingLists.find((l) => l.id === expandedId)?.title}
              </h2>
              <p className="text-gray-600 mt-1">
                {readingLists.find((l) => l.id === expandedId)?.course_code}
              </p>
            </div>
            <button
              onClick={() => setExpandedId(null)}
              className="text-2xl font-light hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {readingLists.find((l) => l.id === expandedId) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="label">Lecturer</label>
                  <p className="text-gray-800">
                    {readingLists.find((l) => l.id === expandedId)?.lecturer_name}
                  </p>
                </div>
                <div>
                  <label className="label">Faculty</label>
                  <p className="text-gray-800">
                    {readingLists.find((l) => l.id === expandedId)?.faculty}
                  </p>
                </div>
                <div>
                  <label className="label">Total Items</label>
                  <p className="text-gray-800">
                    {readingLists.find((l) => l.id === expandedId)?.item_count}
                  </p>
                </div>
                <div>
                  <label className="label">Items Used This Semester</label>
                  <p className="text-gray-800">
                    {readingLists.find((l) => l.id === expandedId)?.usage_count}
                  </p>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Short Loan Configuration</h3>
                <div className="p-4 bg-primary-50 rounded flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Short Loan</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Allow 2-hour and overnight loans for high-demand items
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        readingLists.find((l) => l.id === expandedId)
                          ?.short_loan_enabled || false
                      }
                      onChange={() => {
                        const list = readingLists.find((l) => l.id === expandedId);
                        if (list) {
                          toggleShortLoan(expandedId, list.short_loan_enabled);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
                  </label>
                </div>
              </div>

              {readingLists.find((l) => l.id === expandedId)?.items_with_low_copies! > 0 && (
                <div className="border-t mt-6 pt-6">
                  <h3 className="text-lg font-semibold mb-3 text-yellow-700">
                    ⚠️ Items with Less Than 2 Copies
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Consider acquiring additional copies or enabling short loans for these items:
                  </p>
                  <div className="space-y-2">
                    {[...Array(readingLists.find((l) => l.id === expandedId)?.items_with_low_copies)].map(
                      (_, idx) => (
                        <div key={idx} className="p-3 bg-yellow-50 rounded border border-yellow-200">
                          <p className="font-medium">Sample Item {idx + 1}</p>
                          <p className="text-sm text-gray-600">1 copy available - High demand</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
