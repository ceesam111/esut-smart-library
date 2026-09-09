import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import QRCode from 'qrcode';

type CitationStyle = 'APA' | 'Harvard' | 'MLA' | 'Chicago';
type ActiveTab = 'details' | 'citations' | 'discussion';

function buildCitation(item: any, style: CitationStyle): string {
  const authors: string[] = Array.isArray(item.authors) ? item.authors : [item.authors ?? 'Unknown'];
  const year = item.year ?? 'n.d.';
  const title = item.title ?? 'Untitled';
  const publisher = item.publisher ?? institutionConfig.name;
  const place = item.place_of_publication ?? '';
  const edition = item.edition ? ` (${item.edition} ed.)` : '';
  const a0 = authors[0] ?? 'Unknown';
  const allAuthors = authors.join(', ');

  switch (style) {
    case 'APA':
      return `${allAuthors} (${year}). ${title}${edition}. ${place ? place + ': ' : ''}${publisher}.`;
    case 'Harvard':
      return `${allAuthors} (${year}) ${title}${edition}. ${place ? place + ': ' : ''}${publisher}.`;
    case 'MLA':
      return `${a0}. ${title}${edition}. ${place ? place + ': ' : ''}${publisher}, ${year}.`;
    case 'Chicago':
      return `${a0}. ${title}${edition}. ${place ? place + ': ' : ''}${publisher}, ${year}.`;
  }
}

export default function CatalogueItem() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [copies, setCopies] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>('details');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [patron, setPatron] = useState<any>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const init = async () => {
      // Fetch item
      const { data } = await supabase.from('catalogue_items').select('*').eq('id', id!).single();
      setItem(data);

      if (data) {
        // Increment view count
        await supabase.from('catalogue_items').update({ view_count: (data.view_count ?? 0) + 1 }).eq('id', id!);

        // Fetch copies per branch
        const { data: copiesData } = await supabase.from('catalogue_copies').select('*').eq('item_id', id!);
        setCopies(copiesData ?? []);

        // Generate QR code
        const url = window.location.href;
        const qr = await QRCode.toDataURL(url, { width: 120, margin: 1, color: { dark: '#1A5C32' } });
        setQrUrl(qr);
      }

      // Fetch discussions
      const { data: disc } = await supabase
        .from('catalogue_discussions')
        .select('*')
        .eq('item_id', id!)
        .is('parent_id', null)
        .order('created_at', { ascending: true });
      setDiscussions(disc ?? []);

      // Get auth user
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        const { data: p } = await supabase.from('patrons').select('full_name').eq('user_id', u.id).maybeSingle();
        setPatron(p);
      }

      setLoading(false);
    };
    init();
  }, [id]);

  const handleReserve = async () => {
    if (!user) { window.location.href = '/login'; return; }
    const { error } = await supabase.from('reservations').insert({
      patron_id: patron?.id,
      item_id: id,
      status: 'pending',
      reserved_at: new Date().toISOString(),
    });
    if (!error) alert('Item reserved successfully!');
  };

  const handleILL = async () => {
    if (!user) { window.location.href = '/login'; return; }
    window.location.href = `/dashboard/ill?title=${encodeURIComponent(item?.title ?? '')}`;
  };

  const handleCopyDownload = async () => {
    await supabase.from('catalogue_items').update({ download_count: (item.download_count ?? 0) + 1 }).eq('id', id!);
    setItem((prev: any) => ({ ...prev, download_count: (prev.download_count ?? 0) + 1 }));
  };

  const submitComment = async () => {
    if (!newComment.trim() || !user) return;
    setSubmittingComment(true);
    const { data, error } = await supabase.from('catalogue_discussions').insert({
      item_id: id,
      user_id: user.id,
      patron_name: patron?.full_name ?? user.email,
      body: newComment.trim(),
    }).select().single();
    if (!error && data) {
      setDiscussions(prev => [...prev, data]);
      setNewComment('');
    }
    setSubmittingComment(false);
  };

  const copyCitation = () => {
    navigator.clipboard.writeText(buildCitation(item, citationStyle));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="pt-16 min-h-screen bg-neutral-50">
        <div className="section py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="space-y-4">
              <div className="aspect-[3/4] bg-neutral-200 rounded-xl" />
              <div className="h-24 bg-neutral-200 rounded-xl" />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="h-8 bg-neutral-200 rounded w-3/4" />
              <div className="h-4 bg-neutral-200 rounded w-1/2" />
              <div className="h-32 bg-neutral-200 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center">
        <div className="text-center text-neutral-400">
          <p className="text-5xl mb-3">📚</p>
          <p>Item not found</p>
          <Link to="/catalogue" className="btn-primary mt-4">Back to Catalogue</Link>
        </div>
      </div>
    );
  }

  const subjects: string[] = Array.isArray(item.subjects) ? item.subjects : [];
  const byFaculty = copies.reduce((acc: any, c) => {
    const key = c.faculty_code || c.branch || 'Main Library';
    if (!acc[key]) acc[key] = { available: 0, total: 0 };
    acc[key].total++;
    if (c.status === 'available') acc[key].available++;
    return acc;
  }, {});

  return (
    <div className="pt-16 bg-neutral-50 min-h-screen">
      <div className="section py-8">
        <Link to="/catalogue" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Catalogue
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT PANEL ──────────────────────────────── */}
          <div className="space-y-4">

            {/* Cover */}
            <div className="card p-4">
              <div className="w-full aspect-[3/4] bg-primary-50 rounded-xl flex items-center justify-center overflow-hidden mb-4">
                {item.cover_image
                  ? <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover rounded-xl" />
                  : (
                    <div className="flex flex-col items-center text-primary-200 gap-2">
                      <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                      </svg>
                      <span className="text-sm text-primary-400 font-medium">{item.format}</span>
                    </div>
                  )
                }
              </div>

              {/* Call number + availability */}
              <div className="space-y-2 text-sm border-t border-neutral-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Call No.</span>
                  <span className="font-mono font-semibold text-primary-700 text-xs bg-primary-50 px-2 py-0.5 rounded">
                    {item.call_number ?? 'TBC'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Copies</span>
                  <span className={`font-semibold text-sm ${item.available_copies > 0 ? 'text-success-600' : 'text-error-600'}`}>
                    {item.available_copies} / {item.total_copies} available
                  </span>
                </div>
                {item.faculty_code && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Faculty</span>
                    <span className="text-neutral-700 text-xs">{item.faculty_code}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 space-y-2">
                {item.available_copies > 0 ? (
                  <button onClick={handleReserve} className="btn-primary w-full">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    Reserve This Item
                  </button>
                ) : (
                  <button onClick={handleILL} className="btn-outline w-full">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    Request via ILL
                  </button>
                )}
                {item.format === 'E-Book' && (
                  <button onClick={handleCopyDownload} className="btn-secondary w-full">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Download
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-2">
              <div className="card flex-1 p-3 flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <div>
                  <div className="font-semibold text-neutral-800">{((item.view_count ?? 0) + 1).toLocaleString()}</div>
                  <div className="text-xs text-neutral-400">Views</div>
                </div>
              </div>
              {item.download_count > 0 && (
                <div className="card flex-1 p-3 flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <div>
                    <div className="font-semibold text-neutral-800">{item.download_count.toLocaleString()}</div>
                    <div className="text-xs text-neutral-400">Downloads</div>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code */}
            {qrUrl && (
              <div className="card p-4 flex flex-col items-center gap-2">
                <img src={qrUrl} alt="QR Code" className="w-24 h-24" />
                <p className="text-xs text-neutral-400 text-center">Scan to share this item</p>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ─────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Title block */}
            <div className="card p-6">
              <div className="flex flex-wrap gap-2 mb-3">
                {item.format && <span className="badge badge-primary">{item.format}</span>}
                {item.language && <span className="badge badge-secondary">{item.language}</span>}
                {item.edition && <span className="badge badge-gold">{item.edition} ed.</span>}
              </div>

              <h1 className="text-2xl font-serif font-semibold text-primary-800 leading-snug mb-2">{item.title}</h1>

              <p className="text-neutral-600 text-sm mb-1">
                {Array.isArray(item.authors) ? item.authors.join('; ') : item.authors}
              </p>

              {(item.publisher || item.year) && (
                <p className="text-xs text-neutral-400">
                  {[item.place_of_publication, item.publisher, item.year].filter(Boolean).join(' · ')}
                </p>
              )}

              {subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {subjects.map((s: string) => (
                    <Link key={s} to={`/catalogue?subject=${encodeURIComponent(s)}`}
                      className="badge badge-secondary hover:bg-secondary-200 transition-colors cursor-pointer">
                      {s}
                    </Link>
                  ))}
                </div>
              )}

              {item.abstract && (
                <p className="mt-4 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-4">
                  {item.abstract}
                </p>
              )}
            </div>

            {/* Faculty availability table */}
            {Object.keys(byFaculty).length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-100">
                  <h3 className="font-semibold text-neutral-800 text-sm">Availability by Location</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Location</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Call No.</th>
                      <th className="text-center px-5 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Available</th>
                      <th className="text-center px-5 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byFaculty).map(([loc, counts]: [string, any]) => (
                      <tr key={loc} className="border-t border-neutral-100">
                        <td className="px-5 py-3 font-medium text-neutral-700">{loc}</td>
                        <td className="px-5 py-3 font-mono text-xs text-neutral-500">{item.call_number ?? '—'}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-semibold ${counts.available > 0 ? 'text-success-600' : 'text-error-500'}`}>
                            {counts.available}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-neutral-600">{counts.total}</td>
                      </tr>
                    ))}
                    {copies.length === 0 && (
                      <tr>
                        <td className="px-5 py-3 font-medium text-neutral-700">Main Library</td>
                        <td className="px-5 py-3 font-mono text-xs text-neutral-500">{item.call_number ?? '—'}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`font-semibold ${item.available_copies > 0 ? 'text-success-600' : 'text-error-500'}`}>
                            {item.available_copies}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-neutral-600">{item.total_copies}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tabs */}
            <div className="card overflow-hidden">
              <div className="flex border-b border-neutral-100">
                {(['details', 'citations', 'discussion'] as ActiveTab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors relative
                      ${tab === t ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-700'}`}>
                    {t}
                    {t === 'discussion' && discussions.length > 0 && (
                      <span className="ml-1.5 bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">{discussions.length}</span>
                    )}
                    {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* Details tab */}
                {tab === 'details' && (
                  <div className="text-sm space-y-3">
                    {[
                      ['ISBN', item.isbn],
                      ['Call Number', item.call_number],
                      ['Publisher', item.publisher],
                      ['Place', item.place_of_publication],
                      ['Year', item.year],
                      ['Edition', item.edition],
                      ['Series', item.series],
                      ['Language', item.language],
                      ['Faculty', item.faculty_code ? institutionConfig.faculties.find(f => f.code === item.faculty_code)?.name ?? item.faculty_code : null],
                      ['Physical Desc.', item.physical_description],
                      ['Notes', item.notes],
                    ].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                      <div key={k as string} className="flex gap-4">
                        <span className="w-28 shrink-0 text-neutral-400 font-medium">{k}</span>
                        <span className="text-neutral-800">{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Citations tab */}
                {tab === 'citations' && (
                  <div>
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {(['APA', 'Harvard', 'MLA', 'Chicago'] as CitationStyle[]).map(c => (
                        <button key={c} onClick={() => setCitationStyle(c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                            ${citationStyle === c ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm font-mono text-neutral-700 leading-relaxed">
                      {buildCitation(item, citationStyle)}
                    </div>
                    <button onClick={copyCitation} className="btn-ghost text-xs mt-2 flex items-center gap-1">
                      {copied
                        ? <><svg className="w-3.5 h-3.5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied!</>
                        : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy citation</>
                      }
                    </button>
                  </div>
                )}

                {/* Discussion tab */}
                {tab === 'discussion' && (
                  <div className="space-y-4">
                    {discussions.length === 0 && (
                      <p className="text-neutral-400 text-sm">No discussion yet. Be the first to comment.</p>
                    )}
                    {discussions.map(d => (
                      <div key={d.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {d.patron_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 bg-neutral-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-neutral-700">{d.patron_name}</span>
                            <span className="text-xs text-neutral-400">{new Date(d.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-neutral-700">{d.body}</p>
                        </div>
                      </div>
                    ))}

                    {user ? (
                      <div className="flex gap-3 pt-2 border-t border-neutral-100">
                        <div className="w-8 h-8 rounded-full bg-primary-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {patron?.full_name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <textarea
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            placeholder="Share your thoughts about this item…"
                            rows={3}
                            className="input w-full resize-none text-sm"
                          />
                          <div className="flex justify-end mt-2">
                            <button onClick={submitComment} disabled={!newComment.trim() || submittingComment}
                              className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                              {submittingComment ? 'Posting…' : 'Post Comment'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-neutral-100 pt-4">
                        <Link to="/login" className="btn-outline text-sm">Sign in to join the discussion</Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
