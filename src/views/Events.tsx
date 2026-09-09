import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  faculty: string;
  category: string;
  cover_image: string;
}

type ViewMode = 'month' | 'week' | 'list';

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [faculties, setFaculties] = useState<string[]>([]);
  const [categories] = useState(['Workshop', 'Lecture', 'Reading Circle', 'Exhibition']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [selectedFaculty, selectedCategory]);

  const fetchEvents = async () => {
    setLoading(true);
    let query = supabase.from('events').select('*').order('start_date', { ascending: true });

    if (selectedFaculty) {
      query = query.eq('faculty', selectedFaculty);
    }
    if (selectedCategory) {
      query = query.eq('category', selectedCategory);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching events:', error);
    } else {
      setEvents(data || []);
      const uniqueFaculties = [...new Set((data || []).map(e => e.faculty))];
      setFaculties(uniqueFaculties.filter(Boolean));
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Events Calendar</h1>
        <p className="text-gray-600">Upcoming events at {institutionConfig.name}</p>
      </div>

      <div className="section">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setViewMode('month')}
            className={`btn-outline ${viewMode === 'month' ? 'bg-primary text-white' : ''}`}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`btn-outline ${viewMode === 'week' ? 'bg-primary text-white' : ''}`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`btn-outline ${viewMode === 'list' ? 'bg-primary text-white' : ''}`}
          >
            List
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="label">Faculty</label>
            <select
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              className="input w-full"
            >
              <option value="">All Faculties</option>
              {faculties.map(faculty => (
                <option key={faculty} value={faculty}>{faculty}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input w-full"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin">Loading...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <div key={event.id} className="card overflow-hidden">
                {event.cover_image && (
                  <div className="h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={event.cover_image}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg flex-1">{event.title}</h3>
                    <span className="badge badge-primary text-xs ml-2">{event.category}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium">{formatDate(event.start_date)}</span>
                      {event.start_time && (
                        <span className="ml-2">{formatTime(event.start_time)}</span>
                      )}
                    </div>
                    {event.location && (
                      <div className="text-gray-700">
                        <span className="font-medium">Location:</span> {event.location}
                      </div>
                    )}
                    {event.faculty && (
                      <div className="text-gray-700">
                        <span className="font-medium">Faculty:</span> {event.faculty}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
