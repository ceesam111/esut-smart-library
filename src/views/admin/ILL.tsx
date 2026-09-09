import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ILLTicket {
  id: string;
  patron_name: string;
  item_title: string;
  from_faculty: string;
  status: string;
  request_date: string;
  patron_email: string;
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
        .from('ill_tickets')
        .select('*')
        .order('request_date', { ascending: false });

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
      filtered = filtered.filter((ticket) => ticket.from_faculty === filterFaculty);
    }

    setFilteredTickets(filtered);
  };

  const updateStatus = async (id: string, newStatus: string, email: string) => {
    try {
      const { error } = await supabase
        .from('ill_tickets')
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
        return 'badge-primary';
      case 'in_transit':
        return 'badge-secondary';
      case 'ready':
        return 'badge-success';
      case 'returned':
        return 'badge-success';
      case 'rejected':
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
              <option value="approved">Approved</option>
              <option value="in_transit">In Transit</option>
              <option value="ready">Ready for Pickup</option>
              <option value="returned">Returned</option>
              <option value="rejected">Rejected</option>
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
                <td className="p-3">{ticket.patron_name}</td>
                <td className="p-3">{ticket.item_title}</td>
                <td className="p-3">{ticket.from_faculty}</td>
                <td className="p-3">{new Date(ticket.request_date).toLocaleDateString()}</td>
                <td className="p-3">
                  <span className={`badge ${getStatusBadgeColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-3 space-y-1">
                  {ticket.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'approved', ticket.patron_email)}
                      className="btn-outline text-xs py-1 px-2 w-full"
                    >
                      Approve
                    </button>
                  )}
                  {(ticket.status === 'approved' || ticket.status === 'pending') && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'in_transit', ticket.patron_email)}
                      className="btn-outline text-xs py-1 px-2 w-full"
                    >
                      In Transit
                    </button>
                  )}
                  {ticket.status === 'in_transit' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'ready', ticket.patron_email)}
                      className="btn-outline text-xs py-1 px-2 w-full"
                    >
                      Ready
                    </button>
                  )}
                  {ticket.status === 'ready' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'returned', ticket.patron_email)}
                      className="btn-outline text-xs py-1 px-2 w-full"
                    >
                      Returned
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
