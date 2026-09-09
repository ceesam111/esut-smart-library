import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface Event {
  id: string;
  title: string;
  description: string;
  cover_image_url: string;
  start_date: string;
  end_date: string;
  faculty: string;
  location: string;
  category: string;
  registration_enabled: boolean;
  capacity: number;
}

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Event>({
    id: '',
    title: '',
    description: '',
    cover_image_url: '',
    start_date: '',
    end_date: '',
    faculty: institutionConfig.faculties[0]?.code || '',
    location: '',
    category: 'seminar',
    registration_enabled: true,
    capacity: 0,
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Event, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveEvent = async () => {
    try {
      if (editingId) {
        const { error } = await supabase
          .from('events')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert([formData]);
        if (error) throw error;
      }

      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      title: '',
      description: '',
      cover_image_url: '',
      start_date: '',
      end_date: '',
      faculty: institutionConfig.faculties[0]?.code || '',
      location: '',
      category: 'seminar',
      registration_enabled: true,
      capacity: 0,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const editEvent = (event: Event) => {
    setFormData(event);
    setEditingId(event.id);
    setShowForm(true);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  if (loading) {
    return <div className="p-8">Loading events...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Event Management</h1>
          <p className="text-gray-600 mt-2">Manage library events and programs</p>
        </div>
        <button onClick={openNewForm} className="btn-primary">
          New Event
        </button>
      </div>

      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="card overflow-hidden hover:shadow-lg transition-shadow">
              {event.cover_image_url && (
                <img
                  src={event.cover_image_url}
                  alt={event.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{event.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
                </div>

                <div className="text-sm space-y-1 text-gray-600">
                  <p>📅 {new Date(event.start_date).toLocaleDateString()}</p>
                  <p>📍 {event.location}</p>
                  <p>🏫 {event.faculty}</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className="badge badge-secondary text-xs">{event.category}</span>
                  {event.registration_enabled && (
                    <span className="badge badge-success text-xs">Registration Open</span>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <button
                    onClick={() => editEvent(event)}
                    className="btn-outline flex-1 text-sm py-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="btn-outline text-red-600 flex-1 text-sm py-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="text-2xl font-semibold mb-6">
            {editingId ? 'Edit Event' : 'Create New Event'}
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Title</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Event title"
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  className="input w-full"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  <option value="seminar">Seminar</option>
                  <option value="workshop">Workshop</option>
                  <option value="conference">Conference</option>
                  <option value="training">Training</option>
                  <option value="lecture">Lecture</option>
                  <option value="exhibition">Exhibition</option>
                </select>
              </div>

              <div>
                <label className="label">Faculty</label>
                <select
                  className="input w-full"
                  value={formData.faculty}
                  onChange={(e) => handleInputChange('faculty', e.target.value)}
                >
                  {institutionConfig.faculties.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Location</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Event location"
                />
              </div>

              <div>
                <label className="label">Start Date & Time</label>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                />
              </div>

              <div>
                <label className="label">End Date & Time</label>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                />
              </div>

              <div>
                <label className="label">Cover Image URL</label>
                <input
                  type="url"
                  className="input w-full"
                  value={formData.cover_image_url}
                  onChange={(e) => handleInputChange('cover_image_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="label">Capacity</label>
                <input
                  type="number"
                  className="input w-full"
                  value={formData.capacity}
                  onChange={(e) => handleInputChange('capacity', parseInt(e.target.value))}
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input w-full"
                rows={5}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Event description"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.registration_enabled}
                  onChange={(e) => handleInputChange('registration_enabled', e.target.checked)}
                />
                <span className="font-medium">Enable Registration</span>
              </label>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <button onClick={resetForm} className="btn-ghost flex-1">
                Cancel
              </button>
              <button onClick={saveEvent} className="btn-primary flex-1">
                {editingId ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
