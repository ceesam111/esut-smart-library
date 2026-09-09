import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ── Block types ───────────────────────────────────────────────────────────────

export type BlockType =
  | 'heading' | 'paragraph' | 'image' | 'two-column' | 'button'
  | 'divider' | 'quote' | 'faq' | 'contact-form' | 'staff-profile'
  | 'newsletter-widget' | 'latest-blogs' | 'upcoming-events' | 'featured-resources';

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, any>;
}

interface CMSPage {
  id?: string;
  title: string;
  slug: string;
  blocks: Block[];
  status: 'draft' | 'published';
}

const BLOCK_DEFS: { type: BlockType; label: string; icon: string; defaultData: Record<string, any> }[] = [
  { type: 'heading',            label: 'Heading',           icon: 'H',  defaultData: { level: 'h2', text: 'New Heading' } },
  { type: 'paragraph',          label: 'Paragraph',         icon: '¶',  defaultData: { text: 'Enter paragraph text here…' } },
  { type: 'image',              label: 'Image',             icon: '🖼', defaultData: { url: '', alt: '', caption: '' } },
  { type: 'two-column',         label: 'Two Column',        icon: '⧉',  defaultData: { left: [], right: [] } },
  { type: 'button',             label: 'Button',            icon: '⬜', defaultData: { label: 'Click Here', url: '/', style: 'primary' } },
  { type: 'divider',            label: 'Divider',           icon: '—',  defaultData: {} },
  { type: 'quote',              label: 'Quote',             icon: '"',  defaultData: { text: 'Quote text', attribution: '' } },
  { type: 'faq',                label: 'FAQ Accordion',     icon: '?',  defaultData: { items: [{ q: 'Question?', a: 'Answer.' }] } },
  { type: 'contact-form',       label: 'Contact Form',      icon: '✉',  defaultData: { heading: 'Contact Us' } },
  { type: 'staff-profile',      label: 'Staff Profile',     icon: '👤', defaultData: { name: 'Staff Name', role: 'Librarian', bio: '', email: '', photo: '' } },
  { type: 'newsletter-widget',  label: 'Newsletter Signup', icon: '📧', defaultData: {} },
  { type: 'latest-blogs',       label: 'Latest Blog Posts', icon: '📰', defaultData: {} },
  { type: 'upcoming-events',    label: 'Upcoming Events',   icon: '📅', defaultData: {} },
  { type: 'featured-resources', label: 'Featured Resources',icon: '📚', defaultData: { ids: [] } },
];

function uid() { return Math.random().toString(36).slice(2); }

// ── Block editor forms ────────────────────────────────────────────────────────

function BlockEditor({ block, onChange }: { block: Block; onChange: (data: Record<string, any>) => void }) {
  const d = block.data;

  if (block.type === 'heading') return (
    <div className="space-y-2">
      <div>
        <label className="label text-xs">Level</label>
        <select className="input" value={d.level} onChange={e => onChange({ ...d, level: e.target.value })}>
          <option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option>
        </select>
      </div>
      <div>
        <label className="label text-xs">Text</label>
        <input className="input" value={d.text} onChange={e => onChange({ ...d, text: e.target.value })} />
      </div>
    </div>
  );

  if (block.type === 'paragraph') return (
    <div>
      <label className="label text-xs">Content (supports **bold**, *italic*, [link](url))</label>
      <textarea className="input w-full resize-y" rows={5} value={d.text}
        onChange={e => onChange({ ...d, text: e.target.value })} />
    </div>
  );

  if (block.type === 'image') return (
    <div className="space-y-2">
      <div><label className="label text-xs">Image URL</label><input className="input" value={d.url} onChange={e => onChange({ ...d, url: e.target.value })} placeholder="https://…" /></div>
      <div><label className="label text-xs">Alt Text *</label><input className="input" value={d.alt} onChange={e => onChange({ ...d, alt: e.target.value })} /></div>
      <div><label className="label text-xs">Caption</label><input className="input" value={d.caption ?? ''} onChange={e => onChange({ ...d, caption: e.target.value })} /></div>
    </div>
  );

  if (block.type === 'button') return (
    <div className="space-y-2">
      <div><label className="label text-xs">Label</label><input className="input" value={d.label} onChange={e => onChange({ ...d, label: e.target.value })} /></div>
      <div><label className="label text-xs">URL</label><input className="input" value={d.url} onChange={e => onChange({ ...d, url: e.target.value })} /></div>
      <div>
        <label className="label text-xs">Style</label>
        <select className="input" value={d.style} onChange={e => onChange({ ...d, style: e.target.value })}>
          <option value="primary">Primary</option><option value="secondary">Secondary</option><option value="outline">Outline</option>
        </select>
      </div>
    </div>
  );

  if (block.type === 'quote') return (
    <div className="space-y-2">
      <div><label className="label text-xs">Quote Text</label><textarea className="input w-full resize-y" rows={3} value={d.text} onChange={e => onChange({ ...d, text: e.target.value })} /></div>
      <div><label className="label text-xs">Attribution</label><input className="input" value={d.attribution} onChange={e => onChange({ ...d, attribution: e.target.value })} /></div>
    </div>
  );

  if (block.type === 'faq') return (
    <div className="space-y-3">
      {(d.items as { q: string; a: string }[]).map((item, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div><label className="label text-xs">Question {i + 1}</label><input className="input" value={item.q} onChange={e => { const items = [...d.items]; items[i] = { ...item, q: e.target.value }; onChange({ ...d, items }); }} /></div>
          <div><label className="label text-xs">Answer</label><textarea className="input w-full resize-y" rows={2} value={item.a} onChange={e => { const items = [...d.items]; items[i] = { ...item, a: e.target.value }; onChange({ ...d, items }); }} /></div>
          <button onClick={() => { const items = d.items.filter((_: any, j: number) => j !== i); onChange({ ...d, items }); }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
        </div>
      ))}
      <button onClick={() => onChange({ ...d, items: [...d.items, { q: 'New Question?', a: 'Answer.' }] })} className="btn-outline text-xs w-full">+ Add Question</button>
    </div>
  );

  if (block.type === 'staff-profile') return (
    <div className="space-y-2">
      <div><label className="label text-xs">Name</label><input className="input" value={d.name} onChange={e => onChange({ ...d, name: e.target.value })} /></div>
      <div><label className="label text-xs">Role</label><input className="input" value={d.role} onChange={e => onChange({ ...d, role: e.target.value })} /></div>
      <div><label className="label text-xs">Email</label><input className="input" type="email" value={d.email} onChange={e => onChange({ ...d, email: e.target.value })} /></div>
      <div><label className="label text-xs">Bio</label><textarea className="input w-full resize-y" rows={3} value={d.bio} onChange={e => onChange({ ...d, bio: e.target.value })} /></div>
      <div><label className="label text-xs">Photo URL</label><input className="input" value={d.photo} onChange={e => onChange({ ...d, photo: e.target.value })} /></div>
    </div>
  );

  if (block.type === 'contact-form') return (
    <div><label className="label text-xs">Heading</label><input className="input" value={d.heading} onChange={e => onChange({ ...d, heading: e.target.value })} /></div>
  );

  if (block.type === 'divider' || block.type === 'newsletter-widget' || block.type === 'latest-blogs' || block.type === 'upcoming-events') {
    return <p className="text-sm text-neutral-400 italic">No configuration needed — this block renders automatically.</p>;
  }

  if (block.type === 'featured-resources') return (
    <div>
      <label className="label text-xs">Catalogue Item IDs (one per line)</label>
      <textarea className="input w-full resize-y font-mono text-xs" rows={4}
        value={(d.ids as string[]).join('\n')}
        onChange={e => onChange({ ...d, ids: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} />
    </div>
  );

  if (block.type === 'two-column') return (
    <p className="text-sm text-neutral-400 italic">Two-column layout. Add blocks using the sidebar when in column editing mode.</p>
  );

  return null;
}

// ── Block preview ─────────────────────────────────────────────────────────────

function BlockPreview({ block }: { block: Block }) {
  const d = block.data;
  const def = BLOCK_DEFS.find(b => b.type === block.type);

  if (block.type === 'heading') {
    const Tag = d.level as 'h1' | 'h2' | 'h3';
    const sizes = { h1: 'text-2xl', h2: 'text-xl', h3: 'text-lg' };
    return <Tag className={`font-bold ${sizes[d.level as 'h1'] ?? 'text-xl'} text-neutral-800`}>{d.text}</Tag>;
  }
  if (block.type === 'paragraph') return <p className="text-sm text-neutral-600 leading-relaxed line-clamp-2">{d.text}</p>;
  if (block.type === 'image') return (
    <div className="flex items-center gap-2">
      {d.url ? <img src={d.url} alt={d.alt} className="h-12 w-16 object-cover rounded" /> : <div className="h-12 w-16 bg-neutral-200 rounded flex items-center justify-center text-neutral-400 text-xs">No image</div>}
      <span className="text-sm text-neutral-500 truncate">{d.alt || 'Image'}</span>
    </div>
  );
  if (block.type === 'button') return (
    <span className={`inline-block px-4 py-1.5 rounded text-sm font-medium ${d.style === 'primary' ? 'bg-primary-700 text-white' : d.style === 'outline' ? 'border border-primary-700 text-primary-700' : 'bg-neutral-200 text-neutral-700'}`}>{d.label}</span>
  );
  if (block.type === 'divider') return <hr className="border-neutral-200" />;
  if (block.type === 'quote') return <blockquote className="border-l-4 border-primary-600 pl-3 italic text-sm text-neutral-600">"{d.text}"</blockquote>;
  if (block.type === 'faq') return <p className="text-sm text-neutral-500">{d.items.length} FAQ item{d.items.length !== 1 ? 's' : ''}</p>;
  if (block.type === 'staff-profile') return <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs">👤</div><div><p className="text-sm font-medium">{d.name}</p><p className="text-xs text-neutral-400">{d.role}</p></div></div>;
  if (block.type === 'two-column') return <p className="text-sm text-neutral-400 italic">Two-column layout with {((d.left ?? []).length + (d.right ?? []).length)} blocks</p>;

  return <p className="text-sm text-neutral-400 italic">{def?.label} widget</p>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CMS() {
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<CMSPage | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const dragSrcId = useRef<string | null>(null);
  const dragSrcIsNew = useRef<BlockType | null>(null);

  useEffect(() => { loadPages(); }, []);

  async function loadPages() {
    const { data } = await supabase.from('cms_pages').select('id, title, slug, blocks, status').order('title');
    setPages(data?.map(p => ({
      id: p.id, title: p.title, slug: p.slug,
      blocks: Array.isArray(p.blocks) ? p.blocks : [],
      status: (p.status ?? 'draft') as 'draft' | 'published',
    })) ?? []);
    setLoading(false);
  }

  function openPage(page: CMSPage) {
    setSelectedPage({ ...page });
    setSelectedBlockId(null);
    setView('editor');
    setSaved(false);
  }

  async function createPage() {
    if (!newTitle.trim()) return;
    const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data } = await supabase.from('cms_pages').insert({ title: newTitle, slug, blocks: [], status: 'draft' }).select('id, title, slug, blocks, status').single();
    if (data) {
      const page: CMSPage = { id: data.id, title: data.title, slug: data.slug, blocks: [], status: 'draft' };
      setPages(prev => [...prev, page]);
      setNewTitle('');
      setCreating(false);
      openPage(page);
    }
  }

  async function savePage() {
    if (!selectedPage) return;
    setSaving(true);
    const payload = { title: selectedPage.title, slug: selectedPage.slug, blocks: selectedPage.blocks, status: selectedPage.status, updated_at: new Date().toISOString() };
    if (selectedPage.id) {
      await supabase.from('cms_pages').update(payload).eq('id', selectedPage.id);
    }
    await loadPages();
    setSaving(false);
    setSaved(true);
  }

  function addBlock(type: BlockType) {
    if (!selectedPage) return;
    const def = BLOCK_DEFS.find(b => b.type === type)!;
    const block: Block = { id: uid(), type, data: { ...def.defaultData } };
    setSelectedPage(p => p ? { ...p, blocks: [...p.blocks, block] } : null);
    setSelectedBlockId(block.id);
    setSaved(false);
  }

  function updateBlock(id: string, data: Record<string, any>) {
    setSelectedPage(p => p ? { ...p, blocks: p.blocks.map(b => b.id === id ? { ...b, data } : b) } : null);
    setSaved(false);
  }

  function removeBlock(id: string) {
    setSelectedPage(p => p ? { ...p, blocks: p.blocks.filter(b => b.id !== id) } : null);
    if (selectedBlockId === id) setSelectedBlockId(null);
    setSaved(false);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    if (!selectedPage) return;
    const idx = selectedPage.blocks.findIndex(b => b.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= selectedPage.blocks.length) return;
    const blocks = [...selectedPage.blocks];
    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    setSelectedPage(p => p ? { ...p, blocks } : null);
    setSaved(false);
  }

  // Drag handlers for reordering canvas blocks
  function handleCanvasDragStart(id: string) { dragSrcId.current = id; dragSrcIsNew.current = null; }
  function handleSidebarDragStart(type: BlockType) { dragSrcIsNew.current = type; dragSrcId.current = null; }

  function handleCanvasDrop(targetId: string) {
    if (!selectedPage) return;
    if (dragSrcIsNew.current) {
      const def = BLOCK_DEFS.find(b => b.type === dragSrcIsNew.current!)!;
      const block: Block = { id: uid(), type: dragSrcIsNew.current!, data: { ...def.defaultData } };
      const targetIdx = selectedPage.blocks.findIndex(b => b.id === targetId);
      const blocks = [...selectedPage.blocks];
      blocks.splice(targetIdx, 0, block);
      setSelectedPage(p => p ? { ...p, blocks } : null);
      setSelectedBlockId(block.id);
      dragSrcIsNew.current = null;
      setSaved(false);
      return;
    }
    if (!dragSrcId.current || dragSrcId.current === targetId) return;
    const blocks = [...selectedPage.blocks];
    const srcIdx = blocks.findIndex(b => b.id === dragSrcId.current);
    const tgtIdx = blocks.findIndex(b => b.id === targetId);
    const [moved] = blocks.splice(srcIdx, 1);
    blocks.splice(tgtIdx, 0, moved);
    setSelectedPage(p => p ? { ...p, blocks } : null);
    dragSrcId.current = null;
    setSaved(false);
  }

  function handleCanvasDropEnd() {
    if (!selectedPage) return;
    if (dragSrcIsNew.current) {
      addBlock(dragSrcIsNew.current);
      dragSrcIsNew.current = null;
    }
  }

  const selectedBlock = selectedPage?.blocks.find(b => b.id === selectedBlockId) ?? null;

  if (loading) return <div className="p-8 flex items-center justify-center min-h-64"><div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  // ── Page list ──────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CMS Page Builder</h1>
          <p className="text-neutral-500 mt-1">Create and manage website pages with drag-and-drop blocks</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/cms/menu" className="btn-outline">Menu Manager</a>
          <button onClick={() => setCreating(true)} className="btn-primary">+ New Page</button>
        </div>
      </div>

      {creating && (
        <div className="card p-4 flex items-center gap-3">
          <input className="input flex-1" placeholder="Page title…" value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createPage()} autoFocus />
          <button onClick={createPage} disabled={!newTitle.trim()} className="btn-primary">Create</button>
          <button onClick={() => setCreating(false)} className="btn-ghost">Cancel</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="p-3 text-left font-semibold">Title</th>
              <th className="p-3 text-left font-semibold">Slug</th>
              <th className="p-3 text-left font-semibold">Blocks</th>
              <th className="p-3 text-left font-semibold">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-neutral-400">No pages yet. Create your first page.</td></tr>
            )}
            {pages.map(page => (
              <tr key={page.id} className="border-b hover:bg-neutral-50">
                <td className="p-3 font-medium">{page.title}</td>
                <td className="p-3 font-mono text-xs text-neutral-500">/{page.slug}</td>
                <td className="p-3 text-neutral-500">{page.blocks.length}</td>
                <td className="p-3">
                  <span className={`badge text-xs ${page.status === 'published' ? 'badge-success' : 'badge-secondary'}`}>{page.status}</span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => openPage(page)} className="btn-outline text-xs py-1 px-2">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Page editor ────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => setView('list')} className="btn-ghost text-sm py-1.5 px-3">← Pages</button>
        <div className="flex-1 flex items-center gap-3">
          <input className="input text-sm py-1.5 font-semibold max-w-xs"
            value={selectedPage?.title ?? ''} onChange={e => { setSelectedPage(p => p ? { ...p, title: e.target.value } : null); setSaved(false); }} />
          <span className="text-neutral-400 text-sm">/{selectedPage?.slug}</span>
        </div>
        <select className="input text-sm py-1.5 w-32"
          value={selectedPage?.status} onChange={e => { setSelectedPage(p => p ? { ...p, status: e.target.value as 'draft' | 'published' } : null); setSaved(false); }}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <button onClick={savePage} disabled={saving} className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50">
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — block library */}
        <div className="w-48 bg-neutral-50 border-r overflow-y-auto shrink-0 p-3">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2">Blocks</p>
          <div className="space-y-1">
            {BLOCK_DEFS.map(def => (
              <div
                key={def.type}
                draggable
                onDragStart={() => handleSidebarDragStart(def.type)}
                onClick={() => addBlock(def.type)}
                className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white hover:shadow-sm border border-transparent hover:border-neutral-200 transition-all text-sm select-none"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-neutral-200 rounded text-xs font-bold shrink-0">{def.icon}</span>
                <span className="text-neutral-700 text-xs leading-tight">{def.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-neutral-100 p-6"
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleCanvasDropEnd()}>
          {(!selectedPage?.blocks || selectedPage.blocks.length === 0) && (
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-16 text-center bg-white">
              <p className="text-neutral-400 text-sm">Drag blocks from the sidebar or click to add them to the canvas</p>
            </div>
          )}
          <div className="space-y-2 max-w-3xl mx-auto">
            {selectedPage?.blocks.map((block, idx) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => handleCanvasDragStart(block.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.stopPropagation(); handleCanvasDrop(block.id); }}
                onClick={() => setSelectedBlockId(block.id)}
                className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${selectedBlockId === block.id ? 'border-primary-600 shadow-md' : 'border-neutral-200 hover:border-neutral-300'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-1 shrink-0">
                    <span className="text-neutral-300 cursor-grab text-lg leading-none">⠿</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">{BLOCK_DEFS.find(b => b.type === block.type)?.label}</span>
                    </div>
                    <BlockPreview block={block} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); moveBlock(block.id, -1); }} disabled={idx === 0} className="w-6 h-6 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-400 disabled:opacity-30 text-xs">↑</button>
                    <button onClick={e => { e.stopPropagation(); moveBlock(block.id, 1); }} disabled={idx === (selectedPage?.blocks.length ?? 0) - 1} className="w-6 h-6 rounded flex items-center justify-center hover:bg-neutral-100 text-neutral-400 disabled:opacity-30 text-xs">↓</button>
                    <button onClick={e => { e.stopPropagation(); removeBlock(block.id); }} className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 text-red-400 text-xs">×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Block editor panel */}
        <div className="w-72 bg-white border-l overflow-y-auto shrink-0 p-4">
          {selectedBlock ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="font-semibold text-sm text-neutral-800">{BLOCK_DEFS.find(b => b.type === selectedBlock.type)?.label}</p>
                <button onClick={() => setSelectedBlockId(null)} className="text-neutral-400 hover:text-neutral-600 text-lg">×</button>
              </div>
              <BlockEditor block={selectedBlock} onChange={data => updateBlock(selectedBlock.id, data)} />
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-neutral-300 text-center text-sm">
              Click a block to edit its content
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
