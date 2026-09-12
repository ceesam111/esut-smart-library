import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';

interface Fine {
  id: string;
  amount: number;
  reason: string;
  status: string;
  patron_id: string;
  reference_id?: string | null;
  created_at: string;
  paid_at?: string | null;
  patrons?: { full_name: string; patron_id: string } | null;
}

interface PaymentForm {
  fineId: string;
  amount: number;
  payment_method: string;
  reference: string;
}

export default function Fines() {
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFine, setSelectedFine] = useState<Fine | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    fineId: '',
    amount: 0,
    payment_method: 'cash',
    reference: '',
  });
  const [processing, setProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('unpaid');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchFines();
  }, []);

  const fetchFines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fines')
        .select('*, patrons(full_name, patron_id)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFines(data ?? []);
    } catch (error) {
      console.error('Error fetching fines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedFine || processing) return;
    setProcessing(true);

    try {
      const { error: paymentErr } = await supabase.from('payments').insert({
        fine_id: selectedFine.id,
        patron_id: selectedFine.patron_id,
        amount: paymentForm.amount,
        payment_method: paymentForm.payment_method,
        reference: paymentForm.reference || null,
        status: 'completed',
        paid_at: new Date().toISOString(),
      });

      if (paymentErr) throw paymentErr;

      const { error: fineErr } = await supabase
        .from('fines')
        .update({
          status: paymentForm.amount >= selectedFine.amount ? 'paid' : 'partial',
          paid_at: paymentForm.amount >= selectedFine.amount ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedFine.id);

      if (fineErr) throw fineErr;

      setSelectedFine(null);
      setPaymentForm({ fineId: '', amount: 0, payment_method: 'cash', reference: '' });
      fetchFines();
    } catch (error) {
      console.error('Error processing payment:', error);
    } finally {
      setProcessing(false);
    }
  };

  const filteredFines = fines.filter((fine) => {
    const matchesStatus = filterStatus === 'all' || fine.status === filterStatus;
    const matchesSearch =
      !searchTerm ||
      fine.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fine.patrons?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fine.patrons?.patron_id?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalUnpaid = fines
    .filter((f) => f.status === 'unpaid' || f.status === 'outstanding')
    .reduce((sum, f) => sum + f.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading fines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <BackButton />
          <h1 className="text-4xl font-bold text-gray-900">Fine Management</h1>
          <p className="text-gray-600 mt-2">Record payments and manage patron fines</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Unpaid</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              ₦{totalUnpaid.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Unpaid Fines</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {fines.filter((f) => f.status === 'unpaid').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Paid This Month</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {fines.filter((f) => f.status === 'paid').length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="Search by patron or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="unpaid">Unpaid</option>
                <option value="outstanding">Outstanding</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patron
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFines.map((fine) => (
                  <tr key={fine.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {fine.patrons?.full_name ?? 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {fine.patrons?.patron_id ?? 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{fine.reason}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        ₦{fine.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          fine.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : fine.status === 'unpaid'
                            ? 'bg-red-100 text-red-800'
                            : fine.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {fine.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(fine.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(fine.status === 'unpaid' || fine.status === 'outstanding' || fine.status === 'partial') && (
                        <button
                          onClick={() => {
                            setSelectedFine(fine);
                            setPaymentForm({
                              fineId: fine.id,
                              amount: fine.amount,
                              payment_method: 'cash',
                              reference: '',
                            });
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedFine && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Record Payment</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Patron</label>
                  <p className="text-gray-900">
                    {selectedFine.patrons?.full_name} ({selectedFine.patrons?.patron_id})
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fine Amount</label>
                  <p className="text-2xl font-bold text-red-600">₦{selectedFine.amount.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Amount</label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })
                    }
                    max={selectedFine.amount}
                    min={0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, payment_method: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="pos">POS</option>
                    <option value="online">Online Payment</option>
                    <option value="waived">Waived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, reference: e.target.value })
                    }
                    placeholder="e.g., Transaction ID, receipt number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedFine(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={processing || paymentForm.amount <= 0}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Confirm Payment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
