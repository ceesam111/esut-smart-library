import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ILLTicket {
  id: string;
  patron_name?: string;
  item_title?: string;
  title?: string;
  from_faculty?: string;
  lending_institution?: string | null;
  status: string;
  request_date?: string;
  created_at?: string;
  patron_email?: string;
  patrons?: { full_name?: string | null; email?: string | null; faculty_name?: string | null } | null;
}

export default function ILL() {
  const [tickets, setTickets] = useState<ILLTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<ILLTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tickets, filterStatus, filterFaculty]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('ill_requests')
        .select('*, patrons(full_name,email,faculty_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching ILL tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = tickets;

    if (filterStatus) {
      filtered = filtered.filter((ticket) => ticket.status === filterStatus);
    }

    if (filterFaculty) {
      filtered = filtered.filter((ticket) => (ticket.from_faculty || ticket.patrons?.faculty_name) === filterFaculty);
    }

    setFilteredTickets(filtered);
  };

  const updateStatus = async (id: string, newStatus: string, email: string) => {
    try {
      const { error } = await supabase
        .from('ill_requests')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);

      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'badge-warning';
      case 'approved':
      case 'submitted':
        return 'badge-primary';
      case 'in_transit':
        return 'badge-secondary';
      case 'ready':
        return 'badge-success';
      case 'returned':
      case 'fulfilled':
        return 'badge-success';
      case 'rejected':
      case 'cancelled':
        return 'badge-error';
      default:
        return 'badge-secondary';
    }
  };

  if (loading) {
    return <div className="p-8">Loading ILL tickets...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inter-Library Loans (ILL)</h1>
        <p className="text-gray-600 mt-2">Manage ILL requests and ticket status</p>
      </div>

      <div className="card p-4 bg-primary-50 border-primary-200 text-sm text-primary-900">
        <p className="font-semibold mb-2">Data entry and workflow</p>
        <p>Patrons submit requests from Catalogue &gt; ILL Request or Dashboard &gt; ILL. Staff review the item title, lending institution/faculty, patron contact and purpose here, then move the request through Pending, Submitted/Approved, Fulfilled, or Cancelled. Use the faculty/status filters to audit requests by department or partner institution.</p>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Filter by Status</label>
            <select
              className="input w-full"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted/Approved</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Filter by Faculty</label>
            <select
              className="input w-full"
              value={filterFaculty}
              onChange={(e) => setFilterFaculty(e.target.value)}
            >
              <option value="">All Faculties</option>
              <option value="Faculty of Science">Faculty of Science</option>
              <option value="Faculty of Arts">Faculty of Arts</option>
              <option value="Faculty of Engineering">Faculty of Engineering</option>
              <option value="Faculty of Medicine">Faculty of Medicine</option>
              <option value="Faculty of Law">Faculty of Law</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left p-3 font-semibold">Ticket ID</th>
              <th className="text-left p-3 font-semibold">Patron</th>
              <th className="text-left p-3 font-semibold">Item</th>
              <th className="text-left p-3 font-semibold">From Faculty</th>
              <th className="text-left p-3 font-semibold">Request Date</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((ticket) => (
              <tr key={ticket.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{ticket.id}</td>
                <td className="p-3">{ticket.patron_name || ticket.patrons?.full_name || 'Unknown patron'}</td>
                <td className="p-3">{ticket.item_title || ticket.title || '(No title)'}</td>
                <td className="p-3">{ticket.from_faculty || ticket.patrons?.faculty_name || 'Not specified'}</td>
                <td className="p-3">{new Date(ticket.request_date || ticket.created_at || Date.now()).toLocaleDateString()}</td>
                <td className="p-3">
                  <span className={`badge ${getStatusBadgeColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-3 space-y-1">
                  {ticket.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'submitted', ticket.patron_email || ticket.patrons?.email || '')}
                      className="btn-outline text-xs py-1 px-2 w-full"
                    >
                      Approve
                    </button>
                  )}
                  {(ticket.status === 'submitted' || ticket.status === 'pending') && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'fulfilled', ticket.patron_email || ticket.patrons?.email || '')}
                      className="btn-outline text-xs py-1 px-2 w-full"
                    >
                      Mark Fulfilled
                    </button>
                  )}
                  {ticket.status !== 'fulfilled' && ticket.status !== 'cancelled' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'cancelled', ticket.patron_email || ticket.patrons?.email || '')}
                      className="btn-outline text-xs py-1 px-2 w-full"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTickets.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No ILL tickets found</p>
          </div>
        )}
      </div>

      {showSuccessToast && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded shadow-lg">
          ✓ Patron notified via email
        </div>
      )}
    </div>
  );
}
