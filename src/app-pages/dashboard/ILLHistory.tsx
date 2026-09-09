import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ILLTicket {
  id: string;
  title: string;
  status: 'pending' | 'Requested' | 'Approved' | 'In Transit' | 'Ready' | 'Collected' | 'Returned' | string;
  created_at: string;
  notes: string | null;
  patron_id: string;
}

export default function ILLHistory() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<ILLTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [patronId, setPatronId] = useState<string | null>(null);

  useEffect(() => {
    const fetchILLTickets = async () => {
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
        setPatronId(patronData.id);

        const { data: ticketsData, error: ticketsError } = await supabase
          .from('ill_requests')
          .select('*')
          .eq('patron_id', patronData.id)
          .order('created_at', { ascending: false });

        if (ticketsError) throw ticketsError;
        setTickets(ticketsData || []);
      } catch (error) {
        console.error('Error fetching ILL tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchILLTickets();
  }, [navigate]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
      case 'Requested':
        return 'badge-warning';
      case 'Approved':
        return 'badge-primary';
      case 'In Transit':
        return 'badge-secondary';
      case 'Ready':
        return 'badge-success';
      case 'Collected':
        return 'badge-success';
      case 'Returned':
        return 'badge-secondary';
      default:
        return 'badge-secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'Requested':
        return '📋';
      case 'Approved':
        return '✓';
      case 'In Transit':
        return '🚚';
      case 'Ready':
        return '📦';
      case 'Collected':
        return '✓✓';
      case 'Returned':
        return '↩';
      default:
        return '•';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ILL requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Inter-Library Loans</h1>
            <p className="text-gray-600 mt-2">Track your ILL requests</p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Link
              to="/catalogue/ill-request"
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              New Request
            </Link>
          </div>
        </div>

        <div className="card bg-white rounded-lg shadow overflow-hidden">
          {tickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Ticket ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Item Requested
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Request Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Pickup Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-mono font-semibold text-gray-900">
                        {ticket.id.substring(0, 8)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {ticket.title || '(No title)'}
                        </div>
                        {ticket.notes?.includes('Urgency: Urgent') && (
                          <span className="text-xs font-semibold text-red-600">🚨 Urgent</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {getStatusIcon(ticket.status)}
                          </span>
                          <span
                            className={`badge ${getStatusBadgeClass(
                              ticket.status
                            )} px-3 py-1 rounded-full text-xs font-semibold`}
                          >
                            {ticket.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        —
                      </td>
                      <td className="px-6 py-4">
                        <button className="btn-outline px-3 py-1 rounded text-sm font-semibold">
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="mb-4 text-5xl">📚</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No ILL Requests Yet
              </h3>
              <p className="text-gray-600 mb-6">
                Request items from other libraries that we don't have in our
                collection.
              </p>
              <Link
                to="/catalogue/ill-request"
                className="btn-primary inline-block px-6 py-2 rounded font-semibold"
              >
                Submit Your First Request
              </Link>
            </div>
          )}
        </div>

        {tickets.length > 0 && (
          <div className="mt-6 card bg-primary-50 rounded-lg p-6 border border-primary-200">
            <h3 className="font-semibold text-gray-900 mb-3">How ILL Works</h3>
            <div className="grid md:grid-cols-4 gap-4 text-sm text-gray-700">
              <div>
                <div className="font-semibold text-primary-700 mb-1">1. Request</div>
                <p>Submit your ILL request through the catalogue</p>
              </div>
              <div>
                <div className="font-semibold text-primary-700 mb-1">2. Approve</div>
                <p>Library processes and approves your request</p>
              </div>
              <div>
                <div className="font-semibold text-primary-700 mb-1">3. Deliver</div>
                <p>Item is obtained from partner library</p>
              </div>
              <div>
                <div className="font-semibold text-primary-700 mb-1">4. Pickup</div>
                <p>Collect at the library desk when ready</p>
              </div>
            </div>
          </div>
        )}

        <a href="/dashboard" className="btn-ghost px-4 py-2 rounded font-semibold mt-6 block w-fit">
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
