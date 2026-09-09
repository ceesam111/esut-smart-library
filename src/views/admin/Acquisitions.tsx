import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Supplier {
  id: string; name: string; contact_name: string; email: string;
  phone: string; address: string; country: string; lead_time_days: number;
  notes: string; is_active: boolean;
}

interface Recommendation {
  id: string; title: string; authors: string; isbn: string; publisher: string;
  year: number; format: string; faculty_code: string; urgency: string;
  reason: string; status: string; requester_name: string; requester_email: string;
  notes: string; created_at: string;
}

interface PurchaseOrder {
  id: string; po_number: string; supplier_id: string; order_date: string;
  expected_date: string; status: string; faculty_code: string; notes: string;
  currency: string; created_at: string;
  acquisition_suppliers?: { name: string };
  purchase_order_items?: POItem[];
}

interface POItem {
  id: string; po_id: string; title: string; authors: string; isbn: string;
  format: string; quantity: number; unit_price: number; received_qty: number;
  status: string; recommendation_id: string;
}

interface Invoice {
  id: string; po_id: string; invoice_number: string; invoice_date: string;
  amount: number; currency: string; payment_date: string;
  payment_status: string; notes: string; created_at: string;
  purchase_orders?: { po_number: string };
}

interface Budget {
  id: string; faculty_code: string; fiscal_year: string;
  total_amount: number; currency: string; notes: string;
}

interface BudgetWithSpent extends Budget {
  spent: number;
}

type Tab = 'recommendations' | 'suppliers' | 'orders' | 'invoices' | 'budget';

const FISCAL_YEAR = '2025/2026';
const FORMATS = ['Book', 'E-Book', 'Journal', 'Thesis', 'Report', 'Map', 'Video', 'Audio', 'Dataset'];
const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-neutral-100 text-neutral-600',
  normal: 'bg-primary-50 text-primary-700',
  high: 'bg-warning-100 text-warning-700',
  urgent: 'bg-error-100 text-error-700',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning-100 text-warning-700',
  approved: 'bg-primary-100 text-primary-700',
  rejected: 'bg-error-100 text-error-600',
  ordered: 'bg-success-100 text-success-700',
  received: 'bg-neutral-100 text-neutral-700',
  draft: 'bg-neutral-100 text-neutral-600',
  sent: 'bg-primary-100 text-primary-700',
  partial: 'bg-warning-100 text-warning-700',
  cancelled: 'bg-error-100 text-error-600',
  paid: 'bg-success-100 text-success-700',
  disputed: 'bg-error-100 text-error-600',
};

function fmtMoney(n: number, currency = 'NGN') {
  return `${currency} ${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  try { return format(new Date(s), 'dd MMM yyyy'); } catch { return s; }
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${className ?? 'bg-neutral-100 text-neutral-600'}`}>
      {label}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Acquisitions() {
  const [tab, setTab] = useState<Tab>('recommendations');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'suppliers',       label: 'Suppliers' },
    { id: 'orders',          label: 'Purchase Orders' },
    { id: 'invoices',        label: 'Invoices' },
    { id: 'budget',          label: 'Budget' },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Acquisitions</h1>
        <p className="text-neutral-500 mt-1 text-sm">
          Manage purchase recommendations, suppliers, orders, invoices and budgets
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-neutral-200 overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === id
                  ? 'border-primary-700 text-primary-700 bg-primary-50'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'recommendations' && <RecommendationsTab />}
          {tab === 'suppliers'       && <SuppliersTab />}
          {tab === 'orders'          && <PurchaseOrdersTab />}
          {tab === 'invoices'        && <InvoicesTab />}
          {tab === 'budget'          && <BudgetTab />}
        </div>
      </div>
    </div>
  );
}

// ── Recommendations Tab ────────────────────────────────────────────────────────
function RecommendationsTab() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [alertEmail, setAlertEmail] = useState<{ to: string; subject: string; body: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('purchase_recommendations').select('*').order('created_at', { ascending: false });
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setRecs(data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, status: string) => {
    setSaving(true);
    await supabase.from('purchase_recommendations')
      .update({ status, notes: reviewNote, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    setSaving(false);
    setSelected(null);
    setReviewNote('');
    load();
  };

  const markReceived = (rec: Recommendation) => {
    const body = `Dear ${rec.requester_name},\n\nWe are pleased to inform you that the item you recommended has been acquired by the library and is now available for loan:\n\nTitle: ${rec.title}\nAuthor(s): ${rec.authors || 'N/A'}\nISBN: ${rec.isbn || 'N/A'}\n\nPlease visit the library or log in to your patron dashboard to place a reservation.\n\nBest regards,\nESUT Smart Library`;
    setAlertEmail({
      to: rec.requester_email,
      subject: `Your recommended item is now available: ${rec.title}`,
      body,
    });
    supabase.from('purchase_recommendations').update({ status: 'received' }).eq('id', rec.id).then(() => load());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'pending', 'approved', 'rejected', 'ordered', 'received'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : recs.length === 0 ? (
        <EmptyState message="No purchase recommendations found" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left p-3 font-semibold text-neutral-700">Title</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Requested by</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Faculty</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Urgency</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Status</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Date</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="p-3">
                    <p className="font-medium text-neutral-800 line-clamp-1">{r.title}</p>
                    {r.authors && <p className="text-xs text-neutral-500">{r.authors}</p>}
                    {r.isbn && <p className="text-xs font-mono text-neutral-400">ISBN {r.isbn}</p>}
                  </td>
                  <td className="p-3">
                    <p className="text-neutral-700">{r.requester_name || '—'}</p>
                    {r.requester_email && <p className="text-xs text-neutral-400">{r.requester_email}</p>}
                  </td>
                  <td className="p-3 text-neutral-600">{r.faculty_code || '—'}</td>
                  <td className="p-3">
                    <Badge label={r.urgency} className={URGENCY_COLORS[r.urgency]} />
                  </td>
                  <td className="p-3">
                    <Badge label={r.status} className={STATUS_COLORS[r.status]} />
                  </td>
                  <td className="p-3 text-neutral-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="p-3">
                    {r.status === 'pending' && (
                      <button onClick={() => setSelected(r)} className="btn-outline text-xs py-1 px-3">
                        Review
                      </button>
                    )}
                    {r.status === 'ordered' && r.requester_email && (
                      <button onClick={() => markReceived(r)} className="btn-primary text-xs py-1 px-3">
                        Mark Received
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selected && (
        <Modal title={`Review: ${selected.title}`} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="bg-neutral-50 rounded-lg p-4 text-sm space-y-1.5">
              <InfoRow label="Author(s)" value={selected.authors} />
              <InfoRow label="ISBN" value={selected.isbn} mono />
              <InfoRow label="Publisher" value={selected.publisher} />
              <InfoRow label="Faculty" value={selected.faculty_code} />
              <InfoRow label="Urgency" value={selected.urgency} />
              <InfoRow label="Reason" value={selected.reason} />
              <InfoRow label="Requested by" value={`${selected.requester_name} (${selected.requester_email})`} />
            </div>
            <div>
              <label className="label">Librarian Note (optional)</label>
              <textarea className="input" rows={3} value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Reason for approval or rejection…" />
            </div>
            <div className="flex gap-2">
              <button disabled={saving} onClick={() => review(selected.id, 'rejected')}
                className="btn-ghost flex-1 border border-error-300 text-error-600 hover:bg-error-50">
                Reject
              </button>
              <button disabled={saving} onClick={() => review(selected.id, 'approved')}
                className="btn-primary flex-1">
                Approve
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Arrival Alert */}
      {alertEmail && (
        <Modal title="New Arrival Alert Email" onClose={() => setAlertEmail(null)}>
          <div className="space-y-3 text-sm">
            <InfoRow label="To" value={alertEmail.to} />
            <InfoRow label="Subject" value={alertEmail.subject} />
            <div>
              <label className="label">Email Body</label>
              <pre className="bg-neutral-50 rounded-lg p-4 text-xs whitespace-pre-wrap font-sans border border-neutral-200">
                {alertEmail.body}
              </pre>
            </div>
            <a href={`mailto:${alertEmail.to}?subject=${encodeURIComponent(alertEmail.subject)}&body=${encodeURIComponent(alertEmail.body)}`}
              className="btn-primary w-full text-center">
              Open in Email Client
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Suppliers Tab ─────────────────────────────────────────────────────────────
function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const blank: Omit<Supplier, 'id'> = {
    name: '', contact_name: '', email: '', phone: '', address: '',
    country: 'Nigeria', lead_time_days: 14, notes: '', is_active: true,
  };
  const [form, setForm] = useState<Omit<Supplier, 'id'>>(blank);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('acquisition_suppliers').select('*').order('name');
    setSuppliers(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(blank); setShowForm(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contact_name: s.contact_name, email: s.email, phone: s.phone,
      address: s.address, country: s.country, lead_time_days: s.lead_time_days,
      notes: s.notes, is_active: s.is_active });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('acquisition_suppliers').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('acquisition_suppliers').insert(form);
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const toggleActive = async (s: Supplier) => {
    await supabase.from('acquisition_suppliers').update({ is_active: !s.is_active }).eq('id', s.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openNew} className="btn-primary text-sm">Add Supplier</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : suppliers.length === 0 ? (
        <EmptyState message="No suppliers added yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left p-3 font-semibold text-neutral-700">Supplier</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Contact</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Email</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Lead Time</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="p-3">
                    <p className="font-medium text-neutral-800">{s.name}</p>
                    {s.country && <p className="text-xs text-neutral-500">{s.country}</p>}
                  </td>
                  <td className="p-3 text-neutral-600">{s.contact_name || '—'}</td>
                  <td className="p-3 text-neutral-600">{s.email || '—'}</td>
                  <td className="p-3 text-neutral-600">{s.lead_time_days} days</td>
                  <td className="p-3">
                    <Badge label={s.is_active ? 'Active' : 'Inactive'}
                      className={s.is_active ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-500'} />
                  </td>
                  <td className="p-3 flex gap-2 justify-end">
                    <button onClick={() => openEdit(s)} className="text-xs text-primary-600 hover:underline">Edit</button>
                    <button onClick={() => toggleActive(s)} className="text-xs text-neutral-400 hover:text-neutral-600">
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Supplier' : 'Add Supplier'} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Supplier Name <span className="text-error-500">*</span></label>
                <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Contact Person</label>
                <input className="input" value={form.contact_name} onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Lead Time (days)</label>
                <input type="number" className="input" min={1} value={form.lead_time_days}
                  onChange={(e) => setForm((p) => ({ ...p, lead_time_days: +e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <input className="input" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div>
                <label className="label">Country</label>
                <input className="input" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Purchase Orders Tab ───────────────────────────────────────────────────────
function PurchaseOrdersTab() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Pick<Supplier, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const blankForm = {
    supplier_id: '', order_date: new Date().toISOString().slice(0, 10),
    expected_date: '', faculty_code: '', notes: '', currency: 'NGN',
    items: [{ title: '', authors: '', isbn: '', format: 'Book', quantity: 1, unit_price: 0 }],
  };
  const [form, setForm] = useState(blankForm);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('purchase_orders')
      .select('*, acquisition_suppliers(name), purchase_order_items(*)')
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const [{ data: pos }, { data: sups }] = await Promise.all([
      q,
      supabase.from('acquisition_suppliers').select('id, name').eq('is_active', true).order('name'),
    ]);
    setOrders(pos ?? []);
    setSuppliers(sups ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const poTotal = (items: POItem[]) =>
    items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const nextPONumber = () => {
    const n = orders.length + 1;
    return `PO-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
  };

  const addItem = () => setForm((p) => ({
    ...p, items: [...p.items, { title: '', authors: '', isbn: '', format: 'Book', quantity: 1, unit_price: 0 }],
  }));
  const removeItem = (i: number) => setForm((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, patch: object) => setForm((p) => ({
    ...p, items: p.items.map((it, idx) => idx === i ? { ...it, ...patch } : it),
  }));

  const createPO = async () => {
    const validItems = form.items.filter((i) => i.title.trim());
    if (!validItems.length) return;
    setSaving(true);
    const po_number = nextPONumber();
    const { data: po } = await supabase.from('purchase_orders')
      .insert({ po_number, supplier_id: form.supplier_id || null, order_date: form.order_date,
        expected_date: form.expected_date || null, faculty_code: form.faculty_code || null,
        notes: form.notes, currency: form.currency })
      .select('id').single();

    if (po) {
      await supabase.from('purchase_order_items').insert(validItems.map((i) => ({ ...i, po_id: po.id })));
    }
    setSaving(false);
    setShowCreate(false);
    setForm(blankForm);
    load();
  };

  const updatePOStatus = async (id: string, status: string) => {
    await supabase.from('purchase_orders').update({ status }).eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'draft', 'sent', 'partial', 'received', 'cancelled'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          New Purchase Order
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : orders.length === 0 ? (
        <EmptyState message="No purchase orders found" />
      ) : (
        <div className="space-y-2">
          {orders.map((po) => {
            const items = po.purchase_order_items ?? [];
            const total = poTotal(items);
            return (
              <div key={po.id} className="border border-neutral-200 rounded-xl p-4 hover:border-primary-200 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm text-neutral-800">{po.po_number}</span>
                      <Badge label={po.status} className={STATUS_COLORS[po.status]} />
                      {po.faculty_code && <span className="text-xs text-neutral-500">{po.faculty_code}</span>}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {po.acquisition_suppliers?.name ?? 'No supplier'} ·
                      Ordered {fmtDate(po.order_date)}
                      {po.expected_date ? ` · Expected ${fmtDate(po.expected_date)}` : ''}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {items.length} item{items.length !== 1 ? 's' : ''} · {fmtMoney(total, po.currency)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDetail(po)} className="btn-outline text-xs py-1.5 px-3">
                      View Items
                    </button>
                    {po.status === 'draft' && (
                      <button onClick={() => updatePOStatus(po.id, 'sent')} className="btn-primary text-xs py-1.5 px-3">
                        Mark Sent
                      </button>
                    )}
                    {po.status === 'sent' && (
                      <button onClick={() => updatePOStatus(po.id, 'received')} className="btn-primary text-xs py-1.5 px-3">
                        Mark Received
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create PO Modal */}
      {showCreate && (
        <Modal title="New Purchase Order" onClose={() => setShowCreate(false)} wide>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Supplier</label>
                <select className="input" value={form.supplier_id} onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Faculty / Collection</label>
                <select className="input" value={form.faculty_code} onChange={(e) => setForm((p) => ({ ...p, faculty_code: e.target.value }))}>
                  <option value="">General Collection</option>
                  {institutionConfig.faculties.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Order Date</label>
                <input type="date" className="input" value={form.order_date} onChange={(e) => setForm((p) => ({ ...p, order_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Expected Delivery</label>
                <input type="date" className="input" value={form.expected_date} onChange={(e) => setForm((p) => ({ ...p, expected_date: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0 font-semibold">Line Items</label>
                <button onClick={addItem} className="text-xs text-primary-600 hover:text-primary-800 font-medium">+ Add Row</button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-neutral-50 p-2 rounded-lg">
                    <input className="input col-span-4 text-xs py-1.5" placeholder="Title *" value={item.title}
                      onChange={(e) => updateItem(i, { title: e.target.value })} />
                    <input className="input col-span-3 text-xs py-1.5 font-mono" placeholder="ISBN" value={item.isbn}
                      onChange={(e) => updateItem(i, { isbn: e.target.value })} />
                    <input type="number" className="input col-span-1 text-xs py-1.5 text-center" min={1} value={item.quantity}
                      onChange={(e) => updateItem(i, { quantity: +e.target.value })} />
                    <input type="number" className="input col-span-2 text-xs py-1.5 text-right" min={0} step={0.01} placeholder="Price"
                      value={item.unit_price} onChange={(e) => updateItem(i, { unit_price: +e.target.value })} />
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <span className="text-xs text-neutral-500 whitespace-nowrap">
                        {fmtMoney(item.quantity * item.unit_price, form.currency)}
                      </span>
                      {form.items.length > 1 && (
                        <button onClick={() => removeItem(i)} className="text-neutral-300 hover:text-error-500 ml-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-right text-sm font-semibold text-neutral-700 mt-2">
                Total: {fmtMoney(form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0), form.currency)}
              </p>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={createPO} disabled={saving || !form.items.some((i) => i.title.trim())}
                className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create Purchase Order'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {detail && (
        <Modal title={`${detail.po_number} — Items`} onClose={() => setDetail(null)}>
          <div className="space-y-3">
            {(detail.purchase_order_items ?? []).map((item) => (
              <div key={item.id} className="border border-neutral-200 rounded-lg p-3">
                <p className="font-medium text-sm">{item.title}</p>
                {item.authors && <p className="text-xs text-neutral-500">{item.authors}</p>}
                {item.isbn && <p className="text-xs font-mono text-neutral-400">ISBN {item.isbn}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-neutral-600">
                  <span>Qty: {item.quantity}</span>
                  <span>Unit: {fmtMoney(item.unit_price, detail.currency)}</span>
                  <span>Total: {fmtMoney(item.quantity * item.unit_price, detail.currency)}</span>
                  <Badge label={item.status} className={STATUS_COLORS[item.status]} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────────────────────
function InvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Pick<PurchaseOrder, 'id' | 'po_number'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = { po_id: '', invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10),
    amount: '', currency: 'NGN', payment_date: '', payment_status: 'pending', notes: '' };
  const [form, setForm] = useState(blank);

  const load = async () => {
    setLoading(true);
    const [{ data: inv }, { data: pos }] = await Promise.all([
      supabase.from('supplier_invoices')
        .select('*, purchase_orders(po_number)')
        .order('created_at', { ascending: false }),
      supabase.from('purchase_orders').select('id, po_number').not('status', 'eq', 'cancelled').order('po_number'),
    ]);
    setInvoices(inv ?? []);
    setOrders(pos ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.invoice_number.trim() || !form.amount) return;
    setSaving(true);
    await supabase.from('supplier_invoices').insert({
      po_id: form.po_id || null, invoice_number: form.invoice_number,
      invoice_date: form.invoice_date, amount: +form.amount, currency: form.currency,
      payment_date: form.payment_date || null, payment_status: form.payment_status,
      notes: form.notes,
    });
    setSaving(false);
    setShowForm(false);
    setForm(blank);
    load();
  };

  const updateStatus = async (id: string, payment_status: string, payment_date?: string) => {
    await supabase.from('supplier_invoices').update({
      payment_status, payment_date: payment_date ?? new Date().toISOString().slice(0, 10),
    }).eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Record Invoice</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : invoices.length === 0 ? (
        <EmptyState message="No invoices recorded yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left p-3 font-semibold text-neutral-700">Invoice No.</th>
                <th className="text-left p-3 font-semibold text-neutral-700">PO</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Date</th>
                <th className="text-right p-3 font-semibold text-neutral-700">Amount</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Payment</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="p-3 font-mono text-neutral-800">{inv.invoice_number}</td>
                  <td className="p-3 text-neutral-600">{inv.purchase_orders?.po_number ?? '—'}</td>
                  <td className="p-3 text-neutral-600 whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                  <td className="p-3 text-right font-medium text-neutral-800">{fmtMoney(inv.amount, inv.currency)}</td>
                  <td className="p-3 text-neutral-500 whitespace-nowrap">{inv.payment_date ? fmtDate(inv.payment_date) : '—'}</td>
                  <td className="p-3"><Badge label={inv.payment_status} className={STATUS_COLORS[inv.payment_status]} /></td>
                  <td className="p-3">
                    {inv.payment_status === 'pending' && (
                      <button onClick={() => updateStatus(inv.id, 'paid')}
                        className="text-xs text-success-700 hover:underline font-medium">
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title="Record Invoice" onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Invoice Number <span className="text-error-500">*</span></label>
                <input className="input font-mono" value={form.invoice_number}
                  onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))} />
              </div>
              <div>
                <label className="label">Purchase Order</label>
                <select className="input" value={form.po_id} onChange={(e) => setForm((p) => ({ ...p, po_id: e.target.value }))}>
                  <option value="">Not linked to PO</option>
                  {orders.map((po) => <option key={po.id} value={po.id}>{po.po_number}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Invoice Date</label>
                <input type="date" className="input" value={form.invoice_date}
                  onChange={(e) => setForm((p) => ({ ...p, invoice_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Amount (NGN) <span className="text-error-500">*</span></label>
                <input type="number" className="input" min={0} step={0.01} value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Payment Status</label>
                <select className="input" value={form.payment_status}
                  onChange={(e) => setForm((p) => ({ ...p, payment_status: e.target.value }))}>
                  {['pending', 'paid', 'partial', 'disputed'].map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Payment Date</label>
                <input type="date" className="input" value={form.payment_date}
                  onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={save} disabled={saving || !form.invoice_number.trim() || !form.amount}
                className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Saving…' : 'Record Invoice'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Budget Tab ────────────────────────────────────────────────────────────────
function BudgetTab() {
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(FISCAL_YEAR);
  const blank = { faculty_code: '', fiscal_year: year, total_amount: '', currency: 'NGN', notes: '' };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: bud }, { data: pos }] = await Promise.all([
      supabase.from('acquisition_budgets').select('*').eq('fiscal_year', year).order('faculty_code'),
      supabase.from('purchase_orders')
        .select('faculty_code, purchase_order_items(quantity, unit_price)')
        .not('status', 'eq', 'cancelled') as any,
    ]);

    // Compute spent per faculty from PO totals
    const spentMap: Record<string, number> = {};
    (pos ?? []).forEach((po: any) => {
      const fc = po.faculty_code ?? 'GENERAL';
      const poTotal = (po.purchase_order_items ?? []).reduce(
        (s: number, i: any) => s + i.quantity * i.unit_price, 0
      );
      spentMap[fc] = (spentMap[fc] ?? 0) + poTotal;
    });

    setBudgets((bud ?? []).map((b) => ({ ...b, spent: spentMap[b.faculty_code] ?? 0 })));
    setLoading(false);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (b: Budget) => {
    setEditing(b);
    setForm({ faculty_code: b.faculty_code, fiscal_year: b.fiscal_year,
      total_amount: String(b.total_amount), currency: b.currency, notes: b.notes });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.faculty_code || !form.total_amount) return;
    setSaving(true);
    if (editing) {
      await supabase.from('acquisition_budgets')
        .update({ total_amount: +form.total_amount, notes: form.notes, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
    } else {
      await supabase.from('acquisition_budgets').insert({
        faculty_code: form.faculty_code, fiscal_year: year,
        total_amount: +form.total_amount, currency: form.currency, notes: form.notes,
      });
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm(blank);
    load();
  };

  const totalBudget = budgets.reduce((s, b) => s + b.total_amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const currency = budgets[0]?.currency ?? 'NGN';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-neutral-600">Fiscal Year</label>
          <select className="input py-1.5 text-sm w-36" value={year} onChange={(e) => setYear(e.target.value)}>
            {['2023/2024', '2024/2025', '2025/2026', '2026/2027'].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button onClick={() => { setEditing(null); setForm(blank); setShowForm(true); }} className="btn-primary text-sm">
          Add Budget Entry
        </button>
      </div>

      {budgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
            <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">Total Budget</p>
            <p className="text-2xl font-bold text-primary-800 mt-1">{fmtMoney(totalBudget, currency)}</p>
          </div>
          <div className="bg-warning-50 border border-warning-100 rounded-xl p-4">
            <p className="text-xs font-medium text-warning-600 uppercase tracking-wide">Total Spent</p>
            <p className="text-2xl font-bold text-warning-800 mt-1">{fmtMoney(totalSpent, currency)}</p>
          </div>
          <div className="bg-success-50 border border-success-100 rounded-xl p-4">
            <p className="text-xs font-medium text-success-600 uppercase tracking-wide">Remaining</p>
            <p className="text-2xl font-bold text-success-800 mt-1">{fmtMoney(Math.max(0, totalBudget - totalSpent), currency)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : budgets.length === 0 ? (
        <EmptyState message={`No budget entries for ${year}`} />
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const pct = b.total_amount > 0 ? Math.min(100, (b.spent / b.total_amount) * 100) : 0;
            const remaining = b.total_amount - b.spent;
            const overBudget = remaining < 0;
            return (
              <div key={b.id} className="border border-neutral-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="font-semibold text-neutral-800">{b.faculty_code || 'General Collection'}</p>
                    <p className="text-xs text-neutral-500">{b.fiscal_year}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-neutral-700">{fmtMoney(b.total_amount, b.currency)} allocated</p>
                    <p className={`text-xs font-medium mt-0.5 ${overBudget ? 'text-error-600' : 'text-neutral-500'}`}>
                      {overBudget
                        ? `Over by ${fmtMoney(Math.abs(remaining), b.currency)}`
                        : `${fmtMoney(remaining, b.currency)} remaining`
                      }
                    </p>
                  </div>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2 mb-1">
                  <div
                    className={`h-2 rounded-full transition-all ${overBudget ? 'bg-error-500' : pct > 80 ? 'bg-warning-500' : 'bg-primary-600'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{fmtMoney(b.spent, b.currency)} spent ({pct.toFixed(0)}%)</span>
                  <button onClick={() => openEdit(b)} className="text-primary-600 hover:underline">Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Budget' : 'Add Budget Entry'} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Faculty / Collection <span className="text-error-500">*</span></label>
              <select className="input" value={form.faculty_code}
                onChange={(e) => setForm((p) => ({ ...p, faculty_code: e.target.value }))} disabled={!!editing}>
                <option value="">Select…</option>
                <option value="GENERAL">General Collection</option>
                {institutionConfig.faculties.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Allocated Budget (NGN) <span className="text-error-500">*</span></label>
              <input type="number" className="input" min={0} step={1000} value={form.total_amount}
                onChange={(e) => setForm((p) => ({ ...p, total_amount: e.target.value }))} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={save} disabled={saving || !form.faculty_code || !form.total_amount}
                className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-neutral-800">{title}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return value ? (
    <div className="flex gap-2 text-sm">
      <span className="text-neutral-500 min-w-28 shrink-0">{label}:</span>
      <span className={`text-neutral-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  ) : null;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center text-neutral-400">
      <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}
