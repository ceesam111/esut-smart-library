import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface CourseReserve {
  id: string;
  course_code: string;
  course_title: string;
  semester: string;
  items: CourseItem[];
}

interface CourseItem {
  id: string;
  item_id: string;
  item_title: string;
  item_authors: string;
  is_required: boolean;
}

interface RawCourseData {
  id: string;
  course_code: string;
  course_title: string;
  semester: string;
  reading_list_items: {
    id: string;
    item_id: string;
    item_title: string;
    item_authors: string;
    is_required: boolean;
  }[];
}

export default function DashboardCourseReserves() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseReserve[]>([]);
  const [loading, setLoading] = useState(true);
  const [reservingItem, setReservingItem] = useState<string | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourseReserves = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          navigate('/login');
          return;
        }

        const { data: patronData, error: patronError } = await supabase
          .from('patrons')
          .select('id')
          .eq('user_id', userData.user.id)
          .single();

        if (patronError) throw patronError;

        const { data: coursesData, error: coursesError } = await supabase
          .from('course_reading_lists')
          .select(
            `
            id,
            course_code,
            course_title,
            semester,
            reading_list_items(
              id,
              item_id,
              item_title,
              item_authors,
              is_required
            )
          `
          )
          .eq('patron_id', patronData.id)
          .order('semester', { ascending: false });

        if (coursesError) throw coursesError;

        const formattedCourses = (coursesData as RawCourseData[]).map((course) => ({
          id: course.id,
          course_code: course.course_code,
          course_title: course.course_title,
          semester: course.semester,
          items: course.reading_list_items || [],
        }));

        setCourses(formattedCourses);
      } catch (error) {
        console.error('Error fetching course reserves:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseReserves();
  }, [navigate]);

  const handleReserve = async (itemId: string) => {
    setReservingItem(itemId);
    try {
      const { error } = await supabase.from('patron_reservations').insert([
        {
          item_id: itemId,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        if (error.code === '23505') {
          alert('You already have this item reserved');
        } else {
          throw error;
        }
      } else {
        alert('Item reserved successfully!');
      }
    } catch (error) {
      console.error('Error reserving item:', error);
      alert('Failed to reserve item');
    } finally {
      setReservingItem(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course reserves...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Course Reading Lists</h1>
          <p className="text-gray-600 mt-2">Required and recommended materials for your courses</p>
        </div>

        {courses.length > 0 ? (
          <div className="space-y-4">
            {courses.map((course) => {
              const requiredItems = course.items.filter((item) => item.is_required);
              const recommendedItems = course.items.filter((item) => !item.is_required);
              const isExpanded = expandedCourse === course.id;

              return (
                <div key={course.id} className="card bg-white rounded-lg shadow overflow-hidden">
                  <button
                    onClick={() =>
                      setExpandedCourse(isExpanded ? null : course.id)
                    }
                    className="w-full p-6 flex justify-between items-start hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {course.course_code}
                        </h3>
                        <span className="badge badge-primary px-3 py-1 rounded-full text-xs font-semibold">
                          {course.semester}
                        </span>
                      </div>
                      <p className="text-gray-600">{course.course_title}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {requiredItems.length} required • {recommendedItems.length} recommended
                      </p>
                    </div>
                    <div
                      className={`text-2xl transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    >
                      ▼
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 p-6 bg-gray-50">
                      {requiredItems.length > 0 && (
                        <div className="mb-8">
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="badge badge-error px-2 py-1 rounded text-xs font-semibold">
                              Required
                            </span>
                            <span className="text-gray-600">
                              {requiredItems.length} {requiredItems.length === 1 ? 'item' : 'items'}
                            </span>
                          </h4>
                          <div className="space-y-3">
                            {requiredItems.map((item) => (
                              <div
                                key={item.id}
                                className="bg-white p-4 rounded-lg border-l-4 border-red-500"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-gray-900">
                                      {item.item_title}
                                    </h5>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {item.item_authors}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    <a
                                      href={`/catalogue/${item.item_id}`}
                                      className="btn-outline px-3 py-2 rounded text-sm font-semibold whitespace-nowrap"
                                    >
                                      Read Online
                                    </a>
                                    <button
                                      onClick={() => handleReserve(item.item_id)}
                                      disabled={reservingItem === item.item_id}
                                      className="btn-primary px-3 py-2 rounded text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                                    >
                                      {reservingItem === item.item_id
                                        ? 'Reserving...'
                                        : 'Reserve'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {recommendedItems.length > 0 && (
                        <div>
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="badge badge-secondary px-2 py-1 rounded text-xs font-semibold">
                              Recommended
                            </span>
                            <span className="text-gray-600">
                              {recommendedItems.length} {recommendedItems.length === 1 ? 'item' : 'items'}
                            </span>
                          </h4>
                          <div className="space-y-3">
                            {recommendedItems.map((item) => (
                              <div
                                key={item.id}
                                className="bg-white p-4 rounded-lg border-l-4 border-gray-300"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-gray-900">
                                      {item.item_title}
                                    </h5>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {item.item_authors}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    <a
                                      href={`/catalogue/${item.item_id}`}
                                      className="btn-outline px-3 py-2 rounded text-sm font-semibold whitespace-nowrap"
                                    >
                                      Read Online
                                    </a>
                                    <button
                                      onClick={() => handleReserve(item.item_id)}
                                      disabled={reservingItem === item.item_id}
                                      className="btn-primary px-3 py-2 rounded text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                                    >
                                      {reservingItem === item.item_id
                                        ? 'Reserving...'
                                        : 'Reserve'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {course.items.length === 0 && (
                        <p className="text-gray-600 text-center py-8">
                          No reading list items for this course yet
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card bg-white rounded-lg shadow p-12 text-center">
            <div className="mb-4 text-5xl">📚</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Reference Services
            </h3>
            <p className="text-gray-600 mb-6">
              You don't have any course reading lists available yet. Once your
              courses are configured, their reading lists will appear here.
            </p>
            <a
              href="/dashboard"
              className="btn-primary inline-block px-6 py-2 rounded font-semibold"
            >
              Back to Dashboard
            </a>
          </div>
        )}

        <a href="/dashboard" className="btn-ghost px-4 py-2 rounded font-semibold mt-6 block w-fit">
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
