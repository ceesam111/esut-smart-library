import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface MenuItem {
  id: string;
  menu_key: string;
  label: string;
  url: string;
  parent_id: string | null;
  position: number;
  open_in_new_tab: boolean;
}

const MENU_KEYS = [
  { key: 'main', label: 'Main Navigation' },
  { key: 'footer', label: 'Footer Navigation' },
];

const BLANK: Omit<MenuItem, 'id'> = {
  menu_key: 'main',
  label: '',
  url: '',
  parent_id: null,
  position: 0,
  open_in_new_tab: false,
};

export default function CmsMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeMenu, setActiveMenu] = useState<string>('main');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<MenuItem, 'id'>>(BLANK);
  const [saving, setSaving] = useState(false);
  const [dragSrc, setDragSrc] = useState<string | null>(null);
  const dragOver = useRef<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('cms_menu')
      .select('*')
      .order('menu_key')
      .order('position');
    setItems(data ?? []);
    setLoading(false);
  }

  const menuItems = items.filter(i => i.menu_key === activeMenu && !i.parent_id)
    .sort((a, b) => a.position - b.position);

  function childrenOf(parentId: string) {
    return items.filter(i => i.parent_id === parentId).sort((a, b) => a.position - b.position);
  }

  function startCreate(parentId?: string) {
    setEditingId(null);
    setForm({ ...BLANK, menu_key: activeMenu, parent_id: parentId ?? null });
    setShowForm(true);
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setForm({
      menu_key: item.menu_key,
      label: item.label,
      url: item.url,
      parent_id: item.parent_id,
      position: item.position,
      open_in_new_tab: item.open_in_new_tab,
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.label.trim() || !form.url.trim()) return;
    setSaving(true);
    const maxPos = items.filter(i => i.menu_key === activeMenu && i.parent_id === form.parent_id)
      .reduce((m, i) => Math.max(m, i.position), -1);

    if (editingId) {
      await supabase.from('cms_menu').update(form).eq('id', editingId);
    } else {
      await supabase.from('cms_menu').insert({ ...form, position: maxPos + 1 });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    await supabase.from('cms_menu').delete().or(`id.eq.${id},parent_id.eq.${id}`);
    load();
  }

  async function reorder(dragId: string, dropId: string) {
    const scoped = items.filter(i => i.menu_key === activeMenu);
    const dragItem = scoped.find(i => i.id === dragId);
    const dropItem = scoped.find(i => i.id === dropId);
    if (!dragItem || !dropItem || dragItem.parent_id !== dropItem.parent_id) return;

    const peers = scoped
      .filter(i => i.parent_id === dragItem.parent_id)
      .sort((a, b) => a.position - b.position);

    const without = peers.filter(i => i.id !== dragId);
    const dropIdx = without.findIndex(i => i.id === dropId);
    without.splice(dropIdx, 0, dragItem);

    const updates = without.map((item, idx) => ({ id: item.id, position: idx }));
    await Promise.all(updates.map(u => supabase.from('cms_menu').update({ position: u.position }).eq('id', u.id)));
    load();
  }

  function MenuItemRow({ item, depth = 0 }: { item: MenuItem; depth?: number }) {
    const children = childrenOf(item.id);
    return (
      <div
        draggable
        onDragStart={() => setDragSrc(item.id)}
        onDragOver={e => { e.preventDefault(); dragOver.current = item.id; }}
        onDrop={() => {
          if (dragSrc && dragSrc !== item.id) reorder(dragSrc, item.id);
          setDragSrc(null);
        }}
      >
        <div
          className={`flex items-center gap-3 px-4 py-2.5 border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${
            dragSrc === item.id ? 'opacity-40' : ''
          }`}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          <span className="text-neutral-300 cursor-grab text-lg select-none">⠿</span>
          {depth > 0 && <span className="text-neutral-300 text-sm">↳</span>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-800 truncate">{item.label}</p>
            <p className="text-xs text-neutral-400 truncate">{item.url}</p>
          </div>
          {item.open_in_new_tab && (
            <span className="text-xs bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">↗ new tab</span>
          )}
          <div className="flex gap-1">
            {depth === 0 && (
              <button
                onClick={() => startCreate(item.id)}
                className="text-xs px-2 py-1 text-primary-600 hover:bg-primary-50 rounded transition-colors"
              >
                + Sub
              </button>
            )}
            <button
              onClick={() => startEdit(item)}
              className="text-xs px-2 py-1 text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => remove(item.id)}
              className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
        {children.map(child => <MenuItemRow key={child.id} item={child} depth={depth + 1} />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Menu Manager</h1>
          <p className="text-sm text-neutral-500 mt-1">Drag to reorder. Add sub-items for dropdown menus.</p>
        </div>
        <button
          onClick={() => startCreate()}
          className="bg-primary-700 hover:bg-primary-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Add Item
        </button>
      </div>

      {/* Menu tabs */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg mb-6 w-fit">
        {MENU_KEYS.map(m => (
          <button
            key={m.key}
            onClick={() => setActiveMenu(m.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeMenu === m.key
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">Loading…</div>
        ) : menuItems.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            No items yet. Click "+ Add Item" to get started.
          </div>
        ) : (
          menuItems.map(item => <MenuItemRow key={item.id} item={item} />)
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-5">
              {editingId ? 'Edit Menu Item' : 'New Menu Item'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Label *</label>
                <input
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. About Us"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">URL *</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. /about or https://external.com"
                />
              </div>
              {!form.parent_id && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Menu</label>
                  <select
                    value={form.menu_key}
                    onChange={e => setForm(f => ({ ...f, menu_key: e.target.value }))}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {MENU_KEYS.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.open_in_new_tab}
                  onChange={e => setForm(f => ({ ...f, open_in_new_tab: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-neutral-700">Open in new tab</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.label.trim() || !form.url.trim()}
                className="px-4 py-2 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
