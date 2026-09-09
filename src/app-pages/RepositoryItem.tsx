import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';
import ImageViewer, { isImageFile } from '@/components/repository/ImageViewer';

type CitationStyle = 'apa' | 'harvard' | 'mla' | 'chicago';
type TabType = 'overview' | 'versions' | 'reviews' | 'discussion' | 'annotations' | 'cite';

function Stars({ rating, onClick }: { rating: number; onClick?: (n: number) => void }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={!onClick}
          onClick={() => onClick?.(n)}
          className={`w-5 h-5 ${onClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}>
          <svg viewBox="0 0 24 24" fill={n <= rating ? '#F59E0B' : 'none'} stroke="#F59E0B" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      ))}
    </span>
  );
}

function Initials({ name }: { name: string }) {
  const parts = (name || '?').split(' ');
  return (
    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
      {parts.map(p => p[0]).join('').toUpperCase().slice(0, 2)}
    </div>
  );
}

export default function RepositoryItem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCitation, setActiveCitation] = useState<CitationStyle>('apa');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [patron, setPatron] = useState<any>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [myReview, setMyReview] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [discussions, setDiscussions] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const [annotations, setAnnotations] = useState<any[]>([]);
  const [newHighlight, setNewHighlight] = useState('');
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotationPrivate, setAnnotationPrivate] = useState(false);
  const [submittingAnnotation, setSubmittingAnnotation] = useState(false);

  const [versions, setVersions] = useState<any[]>([]);
  const [reserving, setReserving] = useState(false);
  const [reserveMsg, setReserveMsg] = useState('');
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    const init = async () => {
      const lookup = decodeURIComponent(id ?? '');
      const { data } = await supabase.from('repository_items').select('*').or(`id.eq.${lookup},handle.eq.${lookup}`).maybeSingle();
      setItem(data);
      if (data) {
        await supabase.from('repository_items').update({ view_count: (data.view_count ?? 0) + 1 }).eq('id', id!);
      }

      const [
        { data: revs },
        { data: disc },
        { data: anns },
        { data: vers },
        { data: { user: u } },
      ] = await Promise.all([
        supabase.from('reviews').select('*').eq('item_type', 'repository').eq('item_id', id!).order('created_at', { ascending: false }),
        supabase.from('discussions').select('*').eq('item_type', 'repository').eq('item_id', id!).is('parent_id', null).order('created_at', { ascending: true }),
        supabase.from('annotations').select('*').eq('repo_item_id', id!).order('created_at', { ascending: false }),
        supabase.from('item_versions').select('*').eq('item_id', id!).order('version_number', { ascending: false }),
        supabase.auth.getUser(),
      ]);

      setReviews(revs ?? []);
      if (revs && revs.length > 0) {
        setAvgRating(Math.round((revs.reduce((s: number, r: any) => s + r.rating, 0) / revs.length) * 10) / 10);
      }
      setDiscussions(disc ?? []);
      setAnnotations(anns ?? []);
      setVersions(vers ?? []);
      setUser(u);

      if (u) {
        const { data: p } = await supabase.from('patrons').select('id, full_name, faculty_code').eq('user_id', u.id).maybeSingle();
        setPatron(p);
        const existing = revs?.find((r: any) => r.user_id === u.id);
        if (existing) { setMyReview(existing); setReviewRating(existing.rating); setReviewBody(existing.body ?? ''); }
      }

      setLoading(false);
    };
    init();
  }, [id]);

  const generateCitation = (style: CitationStyle): string => {
    if (!item) return '';
    const authors = Array.isArray(item.authors)
      ? item.authors.map((a: any) => (typeof a === 'string' ? a : a.name ?? '')).join(', ')
      : String(item.authors ?? 'Unknown');
    const { title, year, doi } = item;
    const ref = doi ? `https://doi.org/${doi}` : `${window.location.origin}/repository/${item.handle ?? id}`;
    switch (style) {
      case 'apa': return `${authors} (${year ?? 'n.d.'}). ${title}. Retrieved from ${ref}`;
      case 'harvard': return `${authors}, ${year ?? 'n.d.'}. ${title}. Available at: ${ref}`;
      case 'mla': return `${authors}. "${title}." ${year ?? 'n.d.'}. ${ref}`;
      case 'chicago': return `${authors}. "${title}." ${year ?? 'n.d.'}. Accessed from ${ref}`;
    }
  };

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(generateCitation(activeCitation));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!item?.file_url) return;
    window.open(item.file_url, '_blank');
    await supabase.from('repository_items').update({ download_count: (item.download_count ?? 0) + 1 }).eq('id', id!);
    setItem((prev: any) => ({ ...prev, download_count: (prev.download_count ?? 0) + 1 }));
  };

  const handleReserve = async () => {
    if (!user) { navigate('/login'); return; }
    setReserving(true);
    setReserveMsg('');
    await new Promise(r => setTimeout(r, 600));
    setReserveMsg('Reserve request submitted. A librarian will contact you.');
    setReserving(false);
  };

  const submitReview = async () => {
    if (!reviewRating || !user) return;
    setSubmittingReview(true);
    const payload = {
      user_id: user.id, patron_name: patron?.full_name ?? user.email,
      item_type: 'repository', item_id: id,
      rating: reviewRating, body: reviewBody.trim() || null,
    };
    let saved: any;
    if (myReview) {
      const { data } = await supabase.from('reviews').update({ rating: reviewRating, body: reviewBody.trim() || null }).eq('id', myReview.id).select().single();
      saved = data;
      setReviews(prev => prev.map(r => r.id === myReview.id ? saved : r));
    } else {
      const { data } = await supabase.from('reviews').insert(payload).select().single();
      saved = data;
      if (saved) {
        setReviews(prev => [saved, ...prev]);
        supabase.from('feed_events').insert({
          user_id: user.id, patron_name: patron?.full_name ?? user.email,
          faculty_code: patron?.faculty_code ?? null,
          event_type: 'review_created',
          payload: { item_type: 'repository', item_id: id, item_title: item?.title, rating: reviewRating },
        });
      }
    }
    if (saved) {
      setMyReview(saved);
      const all = myReview ? reviews.map(r => r.id === myReview.id ? saved : r) : [saved, ...reviews];
      setAvgRating(Math.round((all.reduce((s: number, r: any) => s + r.rating, 0) / all.length) * 10) / 10);
    }
    setSubmittingReview(false);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !user) return;
    setSubmittingComment(true);
    const { data, error } = await supabase.from('discussions').insert({
      item_type: 'repository', item_id: id,
      user_id: user.id, patron_name: patron?.full_name ?? user.email,
      body: newComment.trim(), parent_id: replyTo ?? null,
    }).select().single();
    if (!error && data) { setDiscussions(prev => [...prev, data]); setNewComment(''); setReplyTo(null); }
    setSubmittingComment(false);
  };

  const submitAnnotation = async () => {
    if (!newHighlight.trim() || !user) return;
    setSubmittingAnnotation(true);
    const { data, error } = await supabase.from('annotations').insert({
      repo_item_id: id, user_id: user.id, patron_name: patron?.full_name ?? user.email,
      faculty_code: patron?.faculty_code ?? null,
      highlighted_text: newHighlight.trim(), comment: newAnnotation.trim() || null,
      is_private: annotationPrivate,
    }).select().single();
    if (!error && data) {
      setAnnotations(prev => [data, ...prev]);
      setNewHighlight(''); setNewAnnotation(''); setAnnotationPrivate(false);
    }
    setSubmittingAnnotation(false);
  };

  if (loading) {
    return (
      <div className="pt-16 min-h-screen bg-neutral-50">
        <div className="section py-10 animate-pulse">
          <div className="h-4 w-32 bg-neutral-200 rounded mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              <div className="h-48 bg-neutral-200 rounded-xl" />
              <div className="h-32 bg-neutral-200 rounded-xl" />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="h-10 bg-neutral-200 rounded w-3/4" />
              <div className="h-4 bg-neutral-200 rounded w-1/2" />
              <div className="h-48 bg-neutral-200 rounded-xl" />
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
          <p className="text-5xl mb-3">📄</p>
          <p>Item not found</p>
          <Link to="/repository" className="btn-primary mt-4 inline-block">Back to Repository</Link>
        </div>
      </div>
    );
  }

  const authorsArr: any[] = Array.isArray(item.authors) ? item.authors : [];
  const typeLabel = item.item_type || item.type || 'Document';
  const itemUrl = typeof window !== 'undefined' ? `${window.location.origin}/repository/${id}` : '';

  const TABS: { key: TabType; label: string; count?: number }[] = [
    { key: 'overview', label: 'Metadata' },
    { key: 'versions', label: 'Versions', count: versions.length },
    { key: 'reviews', label: 'Reviews', count: reviews.length },
    { key: 'discussion', label: 'Discussion', count: discussions.length },
    { key: 'annotations', label: 'Annotations', count: annotations.length },
    { key: 'cite', label: 'Cite' },
  ];

  const visibilityLabel: Record<string, string> = { global: 'Open Access', faculty: 'Members Only', private: 'Private' };
  const visibilityColor: Record<string, string> = { global: 'badge-success', faculty: 'badge-warning', private: 'badge-secondary' };

  return (
    <div className="pt-16 bg-neutral-50 min-h-screen">
      <div className="section py-8">
        <BackButton />
        <button onClick={() => navigate('/repository')} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Repository
        </button>

        {typeof item.similarity_score === 'number' && item.similarity_score > 20 && (
          <div className="mb-6 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 flex items-start gap-3">
            <span className="text-lg leading-none">⚠️</span>
            <div>
              <p className="font-semibold">Originality review advised</p>
              <p className="mt-0.5">
                This document may contain substantial unoriginal content
                ({Math.round(item.similarity_score)}% similarity detected). Please review before submission.
              </p>
            </div>
          </div>
        )}



        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* LEFT sidebar */}
          <div className="space-y-4">
            {/* Cover / thumbnail */}
            <div className="card p-4">
              <div className="bg-neutral-100 rounded-xl h-48 flex items-center justify-center mb-4">
                <svg className="w-16 h-16 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Access</span>
                  <span className={`badge text-xs ${visibilityColor[item.visibility] ?? 'badge-secondary'}`}>
                    {visibilityLabel[item.visibility] ?? item.visibility}
                  </span>
                </div>
                {item.department && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Department</span>
                    <span className="text-xs font-medium text-neutral-700">{item.department}</span>
                  </div>
                )}
                {item.faculty_code && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Faculty</span>
                    <span className="text-xs font-medium text-neutral-700">{item.faculty_code}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Views</span>
                  <span className="font-semibold">{(item.view_count ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Downloads</span>
                  <span className="font-semibold">{(item.download_count ?? 0).toLocaleString()}</span>
                </div>
                {avgRating > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Rating</span>
                    <div className="flex items-center gap-1">
                      <Stars rating={Math.round(avgRating)} />
                      <span className="text-xs font-semibold">{avgRating}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {item.file_url && (
                  <>
                    <button onClick={handleDownload} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Download PDF
                    </button>
                    {isImageFile(item.file_url) ? (
                      <button onClick={() => setShowImage(v => !v)} className="btn-outline w-full text-sm">
                        {showImage ? 'Close Image Viewer' : '🔍 View Image'}
                      </button>
                    ) : (
                      <button onClick={() => setShowPdf(v => !v)} className="btn-outline w-full text-sm">
                        {showPdf ? 'Close Reader' : 'Read Online'}
                      </button>
                    )}
                  </>
                )}
                <button onClick={handleReserve} disabled={reserving} className="btn-ghost w-full text-sm border border-neutral-200">
                  {reserving ? 'Requesting…' : 'Reserve Copy'}
                </button>
                {reserveMsg && <p className="text-xs text-green-600 text-center">{reserveMsg}</p>}
              </div>
            </div>

            {/* QR Code */}
            <div className="card p-4 text-center">
              <button onClick={() => setShowQR(v => !v)} className="text-xs text-primary-600 hover:text-primary-800 font-medium mb-2">
                {showQR ? 'Hide QR Code' : 'Show QR Code'}
              </button>
              {showQR && (
                <div className="flex flex-col items-center gap-2">
                  <QRCodeSVG value={itemUrl} size={140} level="M" />
                  <p className="text-xs text-neutral-400">Scan to open this item</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT main content */}
          <div className="lg:col-span-3 space-y-4">

            {/* Title + meta header */}
            <div className="card p-6">
              <div className="flex flex-wrap gap-2 mb-3">
                {typeLabel && <span className="badge badge-primary">{typeLabel}</span>}
                {item.year && <span className="badge">{item.year}</span>}
                {item.language && item.language !== 'English' && <span className="badge badge-secondary">{item.language}</span>}
                {item.status && <span className="badge badge-success capitalize">{item.status}</span>}
              </div>

              <h1 className="text-2xl font-serif font-semibold text-primary-800 leading-snug mb-3">{item.title}</h1>

              {/* Authors with ORCID links */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                {authorsArr.map((a: any, i: number) => {
                  const name = typeof a === 'string' ? a : (a.name ?? '');
                  const orcid = typeof a === 'object' ? (a.orcid ?? null) : null;
                  return (
                    <span key={i} className="flex items-center gap-1 text-sm text-neutral-700">
                      <span>{name}</span>
                      {orcid && (
                        <a href={`https://orcid.org/${orcid}`} target="_blank" rel="noopener noreferrer"
                          title={`ORCID: ${orcid}`}
                          className="inline-flex items-center gap-0.5 text-xs text-green-700 hover:underline border border-green-300 bg-green-50 rounded px-1 py-0.5">
                          <svg className="w-3 h-3" viewBox="0 0 256 256" fill="currentColor"><circle cx="128" cy="128" r="128" fill="#A6CE39" /><path d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 178 93 148 93h-23.7v79.4zM88.7 56.8c0 5.5-4.5 9.9-9.9 9.9s-9.9-4.4-9.9-9.9 4.5-9.9 9.9-9.9 9.9 4.4 9.9 9.9z" fill="white"/></svg>
                          ID
                        </a>
                      )}
                      {i < authorsArr.length - 1 && <span className="text-neutral-300">·</span>}
                    </span>
                  );
                })}
              </div>

              {item.supervisor && (
                <p className="text-sm text-neutral-500 mb-2">
                  <span className="font-medium">Supervisor:</span> {item.supervisor}
                </p>
              )}

              {avgRating > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Stars rating={Math.round(avgRating)} />
                  <span className="text-sm font-semibold text-neutral-700">{avgRating}</span>
                  <span className="text-xs text-neutral-400">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
                </div>
              )}

              {item.doi && (
                <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-primary-600 hover:underline border border-primary-200 bg-primary-50 rounded px-2 py-0.5">
                  DOI: {item.doi}
                </a>
              )}
            </div>

            {/* PDF inline reader */}
            {showPdf && item.file_url && (
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-neutral-50">
                  <span className="text-sm font-semibold text-neutral-700">Online Reader</span>
                  <button onClick={() => setShowPdf(false)} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
                </div>
                <iframe
                  src={item.file_url}
                  title="PDF Viewer"
                  className="w-full"
                  style={{ height: '680px' }}
                />
              </div>
            )}

            {/* Image viewer (OpenSeadragon) for image files */}
            {showImage && item.file_url && isImageFile(item.file_url) && (
              <ImageViewer imageUrl={item.file_url} onClose={() => setShowImage(false)} />
            )}

            {/* Abstract */}
            <div className="card p-6">
              <h3 className="font-semibold text-neutral-800 mb-3">Abstract</h3>
              <p className="text-neutral-700 leading-relaxed text-sm">{item.abstract ?? 'No abstract available.'}</p>
              {Array.isArray(item.keywords) && item.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {item.keywords.map((k: string) => (
                    <span key={k} className="badge badge-secondary text-xs">{k}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="card overflow-hidden">
              <div className="flex border-b border-neutral-100 overflow-x-auto">
                {TABS.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`flex-1 min-w-max px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap
                      ${activeTab === t.key ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-700'}`}>
                    {t.label}
                    {t.count != null && t.count > 0 && (
                      <span className="ml-1.5 bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
                    )}
                    {activeTab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />}
                  </button>
                ))}
              </div>

              <div className="p-5">

                {/* Metadata */}
                {activeTab === 'overview' && (
                  <div className="space-y-3 text-sm">
                    {[
                      ['Type', typeLabel],
                      ['Year', item.year],
                      ['Department', item.department],
                      ['Faculty', item.faculty_code],
                      ['Language', item.language],
                      ['Subjects', Array.isArray(item.subjects) ? item.subjects.join(', ') : item.subjects],
                      ['DOI', item.doi],
                      ['Status', item.status],
                      ['Embargo Until', item.embargo_until ? new Date(item.embargo_until).toLocaleDateString() : null],
                    ].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                      <div key={String(k)} className="flex gap-4">
                        <span className="w-32 shrink-0 text-neutral-400 font-medium">{k}</span>
                        {k === 'DOI'
                          ? <a href={`https://doi.org/${v}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{String(v)}</a>
                          : <span className="text-neutral-800">{String(v)}</span>
                        }
                      </div>
                    ))}
                  </div>
                )}

                {/* Version History */}
                {activeTab === 'versions' && (
                  <div className="space-y-3">
                    {versions.length === 0 ? (
                      <p className="text-neutral-400 text-sm text-center py-4">No version history yet.</p>
                    ) : (
                      versions.map((v: any) => (
                        <div key={v.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                          <div>
                            <p className="text-sm font-semibold text-neutral-800">Version {v.version_number}</p>
                            {v.change_note && <p className="text-xs text-neutral-500 mt-0.5">{v.change_note}</p>}
                            <p className="text-xs text-neutral-400 mt-0.5">{new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          </div>
                          {v.file_url && (
                            <a href={v.file_url} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs py-1 px-2">
                              Download
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Reviews */}
                {activeTab === 'reviews' && (
                  <div className="space-y-5">
                    {user ? (
                      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                        <h4 className="font-semibold text-sm text-neutral-700">{myReview ? 'Your Review' : 'Write a Review'}</h4>
                        <div className="flex items-center gap-2">
                          <Stars rating={reviewRating} onClick={setReviewRating} />
                          {reviewRating > 0 && (
                            <span className="text-xs text-neutral-500">{['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewRating]}</span>
                          )}
                        </div>
                        <textarea value={reviewBody} onChange={e => setReviewBody(e.target.value)}
                          placeholder="Share your thoughts (optional)…" rows={3} className="input w-full resize-none text-sm" />
                        <div className="flex justify-end">
                          <button onClick={submitReview} disabled={!reviewRating || submittingReview}
                            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                            {submittingReview ? 'Saving…' : myReview ? 'Update Review' : 'Submit Review'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-neutral-50 rounded-xl p-4">
                        <Link to="/login" className="btn-outline text-sm">Sign in to write a review</Link>
                      </div>
                    )}
                    {reviews.length === 0
                      ? <p className="text-neutral-400 text-sm text-center py-4">No reviews yet.</p>
                      : reviews.map((r: any) => (
                        <div key={r.id} className="flex gap-3">
                          <Initials name={r.patron_name ?? '?'} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-neutral-700">{r.patron_name ?? 'Anonymous'}</span>
                              <Stars rating={r.rating} />
                              <span className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                            {r.body && <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{r.body}</p>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* Discussion */}
                {activeTab === 'discussion' && (
                  <div className="space-y-4">
                    {discussions.length === 0 && <p className="text-neutral-400 text-sm">No discussion yet. Be the first to comment.</p>}
                    {discussions.map(d => (
                      <div key={d.id} className="flex gap-3">
                        <Initials name={d.patron_name ?? '?'} />
                        <div className="flex-1 bg-neutral-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1 justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-neutral-700">{d.patron_name ?? 'Anonymous'}</span>
                              <span className="text-xs text-neutral-400">{new Date(d.created_at).toLocaleDateString()}</span>
                            </div>
                            {user && <button onClick={() => setReplyTo(v => v === d.id ? null : d.id)} className="text-xs text-primary-600 hover:underline">Reply</button>}
                          </div>
                          <p className="text-sm text-neutral-700">{d.body}</p>
                          {replyTo === d.id && (
                            <div className="mt-3 flex gap-2">
                              <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && submitComment()}
                                placeholder="Write a reply…" className="input flex-1 text-xs py-1.5" />
                              <button onClick={submitComment} disabled={!newComment.trim() || submittingComment}
                                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">Post</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {user && !replyTo ? (
                      <div className="flex gap-3 pt-2 border-t border-neutral-100">
                        <Initials name={patron?.full_name ?? user.email ?? '?'} />
                        <div className="flex-1">
                          <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                            placeholder="Share your thoughts about this work…" rows={3} className="input w-full resize-none text-sm" />
                          <div className="flex justify-end mt-2">
                            <button onClick={submitComment} disabled={!newComment.trim() || submittingComment}
                              className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                              {submittingComment ? 'Posting…' : 'Post Comment'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : !user && (
                      <div className="border-t border-neutral-100 pt-4">
                        <Link to="/login" className="btn-outline text-sm">Sign in to join the discussion</Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Annotations */}
                {activeTab === 'annotations' && (
                  <div className="space-y-5">
                    {user ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <h4 className="font-semibold text-sm text-amber-800">Add Annotation</h4>
                        <div>
                          <label className="text-xs font-medium text-neutral-600 mb-1 block">Highlighted text *</label>
                          <textarea value={newHighlight} onChange={e => setNewHighlight(e.target.value)}
                            placeholder="Paste or type the passage you want to annotate…"
                            rows={2} className="input w-full resize-none text-sm bg-white" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-600 mb-1 block">Your comment (optional)</label>
                          <textarea value={newAnnotation} onChange={e => setNewAnnotation(e.target.value)}
                            placeholder="Write your note or comment on this passage…"
                            rows={2} className="input w-full resize-none text-sm bg-white" />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={annotationPrivate} onChange={e => setAnnotationPrivate(e.target.checked)} className="rounded" />
                            <span className="text-neutral-600 text-xs">Private (only visible to you)</span>
                          </label>
                          <button onClick={submitAnnotation} disabled={!newHighlight.trim() || submittingAnnotation}
                            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                            {submittingAnnotation ? 'Saving…' : 'Save Annotation'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <Link to="/login" className="btn-outline text-sm">Sign in to add annotations</Link>
                      </div>
                    )}
                    {annotations.length === 0
                      ? <p className="text-neutral-400 text-sm text-center py-4">No annotations yet.</p>
                      : annotations.map((a: any) => (
                        <div key={a.id} className="border border-amber-200 rounded-xl overflow-hidden">
                          <div className="bg-amber-50 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Initials name={a.patron_name ?? '?'} />
                              <span className="text-xs font-semibold text-neutral-700">{a.patron_name ?? 'Anonymous'}</span>
                              <span className="text-xs text-neutral-400">{new Date(a.created_at).toLocaleDateString()}</span>
                            </div>
                            {a.is_private && <span className="badge text-xs">Private</span>}
                          </div>
                          <div className="px-4 py-3">
                            <blockquote className="border-l-4 border-amber-400 pl-3 text-sm text-neutral-700 italic leading-relaxed mb-2">
                              "{a.highlighted_text}"
                            </blockquote>
                            {a.comment && <p className="text-sm text-neutral-600">{a.comment}</p>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* Citation Generator */}
                {activeTab === 'cite' && (
                  <div className="space-y-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {(['apa', 'harvard', 'mla', 'chicago'] as CitationStyle[]).map(s => (
                        <button key={s} onClick={() => setActiveCitation(s)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors uppercase
                            ${activeCitation === s ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm leading-relaxed text-neutral-700">
                      {generateCitation(activeCitation)}
                    </div>
                    <button onClick={handleCopyCitation} className="btn-outline text-sm">
                      {copied ? '✓ Copied to clipboard' : 'Copy Citation'}
                    </button>
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
