import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { trackClientEvent } from '@/lib/analytics';
import BackButton from '@/components/BackButton';
import ImageViewer, { isImageFile } from '@/components/repository/ImageViewer';
import { useI18n, type TranslationKey } from '@/lib/i18n';

type CitationStyle = 'apa' | 'harvard' | 'mla' | 'chicago';
type TabType = 'overview' | 'versions' | 'reviews' | 'discussion' | 'annotations' | 'cite';

const CITATION_KEYS: Record<CitationStyle, TranslationKey> = {
  apa: 'repositoryItem.apa',
  harvard: 'repositoryItem.harvard',
  mla: 'repositoryItem.mla',
  chicago: 'repositoryItem.chicago',
};

const RATING_KEYS: TranslationKey[] = [
  'repositoryItem.ratingPoor', 'repositoryItem.ratingFair', 'repositoryItem.ratingGood',
  'repositoryItem.ratingVeryGood', 'repositoryItem.ratingExcellent',
];

type AuthorEntry = string | { name?: string | null; orcid?: string | null };

interface RepoItemRow {
  id: string;
  handle: string | null;
  item_type: string | null;
  type: string | null;
  title: string;
  authors: unknown;
  abstract: string | null;
  subjects: string[] | null;
  keywords: string[] | null;
  year: number | null;
  language: string | null;
  faculty_code: string | null;
  department: string | null;
  supervisor: string | null;
  doi: string | null;
  file_url: string | null;
  visibility: string;
  status: string;
  embargo_until: string | null;
  view_count: number;
  download_count: number;
  similarity_score: number | null;
  created_at: string;
}

interface PatronRow {
  id: string;
  full_name: string;
  faculty_code: string | null;
}

interface ReviewRow {
  id: string;
  user_id: string | null;
  rating: number;
  body: string | null;
  patron_name: string | null;
  created_at: string;
}

interface DiscussionRow {
  id: string;
  patron_name: string | null;
  body: string;
  created_at: string;
}

interface AnnotationRow {
  id: string;
  patron_name: string | null;
  created_at: string;
  is_private: boolean;
  highlighted_text: string;
  comment: string | null;
}

interface VersionRow {
  id: string;
  version_number: number;
  change_note: string | null;
  created_at: string;
  file_url: string | null;
}

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
  const { t, formatDate, formatNumber } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<RepoItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCitation, setActiveCitation] = useState<CitationStyle>('apa');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [patron, setPatron] = useState<PatronRow | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [myReview, setMyReview] = useState<ReviewRow | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [discussions, setDiscussions] = useState<DiscussionRow[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const [annotations, setAnnotations] = useState<AnnotationRow[]>([]);
  const [newHighlight, setNewHighlight] = useState('');
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotationPrivate, setAnnotationPrivate] = useState(false);
  const [submittingAnnotation, setSubmittingAnnotation] = useState(false);

  const [versions, setVersions] = useState<VersionRow[]>([]);
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
        void trackClientEvent({
          event_type: 'repository_item_view',
          entity_id: String(data.id),
          entity_type: 'repository_item',
          path: `/repository/${id}`,
        });
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
        setAvgRating(Math.round((revs.reduce((s: number, r: ReviewRow) => s + r.rating, 0) / revs.length) * 10) / 10);
      }
      setDiscussions(disc ?? []);
      setAnnotations(anns ?? []);
      setVersions(vers ?? []);
      setUser(u);

      if (u) {
        const { data: p } = await supabase.from('patrons').select('id, full_name, faculty_code').eq('user_id', u.id).maybeSingle();
        setPatron(p);
        const existing = revs?.find((r: ReviewRow) => r.user_id === u.id);
        if (existing) { setMyReview(existing); setReviewRating(existing.rating); setReviewBody(existing.body ?? ''); }
      }

      setLoading(false);
    };
    void init();
  }, [id]);

  useEffect(() => {
    if (!item) return;
    const isPublic = item.visibility === 'global'
      && item.status === 'published'
      && (!item.embargo_until || new Date(item.embargo_until) <= new Date());
    if (!isPublic) return;

    const tags: Array<{ name: string; content: string }> = [
      { name: 'citation_title', content: String(item.title ?? '') },
    ];

    const authors: unknown[] = Array.isArray(item.authors) ? item.authors : [];
    authors.forEach((entry) => {
      const name = typeof entry === 'string' ? entry : ((entry as { name?: string })?.name ?? '');
      if (name) tags.push({ name: 'citation_author', content: name });
    });

    const publicationYear = item.year ?? (item.created_at ? new Date(item.created_at).getFullYear() : '');
    if (publicationYear) tags.push({ name: 'citation_publication_date', content: String(publicationYear) });
    if (item.doi) tags.push({ name: 'citation_doi', content: String(item.doi) });

    const nodes = tags.map((tag) => {
      const element = document.createElement('meta');
      element.setAttribute('name', tag.name);
      element.setAttribute('content', tag.content);
      document.head.appendChild(element);
      return element;
    });

    return () => nodes.forEach((element) => element.remove());
  }, [item]);

  const generateCitation = (style: CitationStyle): string => {
    if (!item) return '';
    const authors = Array.isArray(item.authors)
      ? item.authors.map((a: AuthorEntry) => (typeof a === 'string' ? a : a.name ?? '')).join(', ')
      : String(item.authors ?? 'Unknown');
    const { title, year, doi } = item;
    const ref = doi ? `https://doi.org/${doi}` : `${window.location.origin}/repository/${item.id ?? id}`;
    switch (style) {
      case 'apa': return `${authors} (${year ?? 'n.d.'}). ${title}. Retrieved from ${ref}`;
      case 'harvard': return `${authors}, ${year ?? 'n.d.'}. ${title}. Available at: ${ref}`;
      case 'mla': return `${authors}. "${title}." ${year ?? 'n.d.'}. ${ref}`;
      case 'chicago': return `${authors}. "${title}." ${year ?? 'n.d.'}. Accessed from ${ref}`;
    }
  };

  const handleCopyCitation = () => {
    void navigator.clipboard.writeText(generateCitation(activeCitation));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!item?.file_url) return;
    window.open(item.file_url, '_blank');
    await supabase.from('repository_items').update({ download_count: (item.download_count ?? 0) + 1 }).eq('id', id!);
    setItem(prev => (prev ? { ...prev, download_count: (prev.download_count ?? 0) + 1 } : prev));
  };

  const handleReserve = async () => {
    if (!user) { await navigate('/login'); return; }
    setReserving(true);
    setReserveMsg('');
    await new Promise(r => setTimeout(r, 600));
    setReserveMsg(t('repositoryItem.reserveSubmitted'));
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
    let saved: ReviewRow;
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
      setAvgRating(Math.round((all.reduce((s: number, r: ReviewRow) => s + r.rating, 0) / all.length) * 10) / 10);
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
          <p>{t('repositoryItem.itemNotFound')}</p>
          <Link to="/repository" className="btn-primary mt-4 inline-block">{t('repositoryItem.backToRepository')}</Link>
        </div>
      </div>
    );
  }

  const authorsArr: AuthorEntry[] = Array.isArray(item.authors) ? item.authors : [];
  const typeLabel = item.item_type || item.type || t('repository.document');
  const itemUrl = typeof window !== 'undefined' ? `${window.location.origin}/repository/${id}` : '';

  const TABS: { key: TabType; labelKey: TranslationKey; count?: number }[] = [
    { key: 'overview', labelKey: 'repositoryItem.metadata' },
    { key: 'versions', labelKey: 'repositoryItem.versions', count: versions.length },
    { key: 'reviews', labelKey: 'repositoryItem.reviews', count: reviews.length },
    { key: 'discussion', labelKey: 'repositoryItem.discussion', count: discussions.length },
    { key: 'annotations', labelKey: 'repositoryItem.annotations', count: annotations.length },
    { key: 'cite', labelKey: 'repositoryItem.cite' },
  ];

  const visibilityLabel: Record<string, TranslationKey> = { global: 'repositoryItem.visibilityOpen', faculty: 'repositoryItem.visibilityMembers', private: 'repositoryItem.visibilityPrivate' };
  const visibilityColor: Record<string, string> = { global: 'badge-success', faculty: 'badge-warning', private: 'badge-secondary' };

  return (
    <div className="pt-16 bg-neutral-50 min-h-screen">
      <div className="section py-8">
        <BackButton label={t('common.back')} />
        <button onClick={() => navigate('/repository')} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t('repositoryItem.backToRepository')}
        </button>

        {typeof item.similarity_score === 'number' && item.similarity_score > 20 && (
          <div className="mb-6 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 flex items-start gap-3">
            <span className="text-lg leading-none">⚠️</span>
            <div>
              <p className="font-semibold">{t('repositoryItem.originalityAdvised')}</p>
              <p className="mt-0.5">{t('repositoryItem.originalityIntro')} ({t('repositoryItem.originalityNote', { percent: Math.round(item.similarity_score) })}</p>
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
                  <span className="text-neutral-500">{t('repositoryItem.access')}</span>
                  <span className={`badge text-xs ${visibilityColor[item.visibility] ?? 'badge-secondary'}`}>
                    {visibilityLabel[item.visibility] ? t(visibilityLabel[item.visibility]) : item.visibility}
                  </span>
                </div>
                {item.department && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{t('repositoryItem.department')}</span>
                    <span className="text-xs font-medium text-neutral-700">{item.department}</span>
                  </div>
                )}
                {item.faculty_code && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{t('repositoryItem.faculty')}</span>
                    <span className="text-xs font-medium text-neutral-700">{item.faculty_code}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t('repositoryItem.views')}</span>
                  <span className="font-semibold">{formatNumber(item.view_count ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t('repositoryItem.downloads')}</span>
                  <span className="font-semibold">{formatNumber(item.download_count ?? 0)}</span>
                </div>
                {avgRating > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">{t('repositoryItem.rating')}</span>
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
                      {t('repositoryItem.downloadPdf')}
                    </button>
                    {isImageFile(item.file_url) ? (
                      <button onClick={() => setShowImage(v => !v)} className="btn-outline w-full text-sm">
                        {showImage ? t('repositoryItem.closeImageViewer') : t('repositoryItem.viewImage')}
                      </button>
                    ) : (
                      <button onClick={() => setShowPdf(v => !v)} className="btn-outline w-full text-sm">
                        {showPdf ? t('repositoryItem.closeReader') : t('repositoryItem.readOnline')}
                      </button>
                    )}
                  </>
                )}
                <button onClick={handleReserve} disabled={reserving} className="btn-ghost w-full text-sm border border-neutral-200">
                  {reserving ? t('repositoryItem.requesting') : t('repositoryItem.reserveCopy')}
                </button>
                {reserveMsg && <p className="text-xs text-green-600 text-center">{reserveMsg}</p>}
              </div>
            </div>

            {/* QR Code */}
            <div className="card p-4 text-center">
              <button onClick={() => setShowQR(v => !v)} className="text-xs text-primary-600 hover:text-primary-800 font-medium mb-2">
                {showQR ? t('repositoryItem.hideQr') : t('repositoryItem.showQr')}
              </button>
              {showQR && (
                <div className="flex flex-col items-center gap-2">
                  <QRCodeSVG value={itemUrl} size={140} level="M" />
                  <p className="text-xs text-neutral-400">{t('repositoryItem.scanToOpen')}</p>
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
                {authorsArr.map((a: AuthorEntry, i: number) => {
                  const name = typeof a === 'string' ? a : (a.name ?? '');
                  const orcid = typeof a === 'object' ? (a.orcid ?? null) : null;
                  return (
                    <span key={i} className="flex items-center gap-1 text-sm text-neutral-700">
                      <span>{name}</span>
                      {orcid && (
                        <a href={`https://orcid.org/${orcid}`} target="_blank" rel="noopener noreferrer"
                          title={t('repositoryItem.orcidTitle', { orcid })}
                          className="inline-flex items-center gap-0.5 text-xs text-green-700 hover:underline border border-green-300 bg-green-50 rounded px-1 py-0.5">
                          <svg className="w-3 h-3" viewBox="0 0 256 256" fill="currentColor"><circle cx="128" cy="128" r="128" fill="#A6CE39" /><path d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 178 93 148 93h-23.7v79.4zM88.7 56.8c0 5.5-4.5 9.9-9.9 9.9s-9.9-4.4-9.9-9.9 4.5-9.9 9.9-9.9 9.9 4.4 9.9 9.9z" fill="white"/></svg>
                          {t('repositoryItem.id')}
                        </a>
                      )}
                      {i < authorsArr.length - 1 && <span className="text-neutral-300">·</span>}
                    </span>
                  );
                })}
              </div>

              {item.supervisor && (
                <p className="text-sm text-neutral-500 mb-2">
                  <span className="font-medium">{t('repositoryItem.supervisor')}</span> {item.supervisor}
                </p>
              )}

              {avgRating > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Stars rating={Math.round(avgRating)} />
                  <span className="text-sm font-semibold text-neutral-700">{avgRating}</span>
                  <span className="text-xs text-neutral-400">{t('repositoryItem.reviewCount', { count: reviews.length })}</span>
                </div>
              )}

              {item.doi && (
                <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-primary-600 hover:underline border border-primary-200 bg-primary-50 rounded px-2 py-0.5">
                  {t('repositoryItem.doiPrefix', { doi: item.doi })}
                </a>
              )}
            </div>

            {/* PDF inline reader */}
            {showPdf && item.file_url && (
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-neutral-50">
                  <span className="text-sm font-semibold text-neutral-700">{t('repositoryItem.onlineReader')}</span>
                  <button onClick={() => setShowPdf(false)} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
                </div>
                <iframe
                  src={item.file_url}
                  title={t('repositoryItem.pdfViewer')}
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
              <h3 className="font-semibold text-neutral-800 mb-3">{t('repositoryItem.abstract')}</h3>
              <p className="text-neutral-700 leading-relaxed text-sm">{item.abstract ?? t('repositoryItem.noAbstract')}</p>
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
                {TABS.map(entry => (
                  <button key={entry.key} onClick={() => setActiveTab(entry.key)}
                    className={`flex-1 min-w-max px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap
                      ${activeTab === entry.key ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-700'}`}>
                    {t(entry.labelKey)}
                    {entry.count != null && entry.count > 0 && (
                      <span className="ml-1.5 bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">{entry.count}</span>
                    )}
                    {activeTab === entry.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />}
                  </button>
                ))}
              </div>

              <div className="p-5">

                {/* Metadata */}
                {activeTab === 'overview' && (
                  <div className="space-y-3 text-sm">
                    {([
                      { id: 'type', label: t('repositoryItem.type'), value: typeLabel },
                      { id: 'year', label: t('repositoryItem.year'), value: item.year },
                      { id: 'department', label: t('repositoryItem.department'), value: item.department },
                      { id: 'faculty', label: t('repositoryItem.faculty'), value: item.faculty_code },
                      { id: 'language', label: t('repositoryItem.language'), value: item.language },
                      { id: 'subjects', label: t('repositoryItem.subjects'), value: Array.isArray(item.subjects) ? item.subjects.join(', ') : item.subjects },
                      { id: 'DOI', label: 'DOI', value: item.doi },
                      { id: 'status', label: t('repositoryItem.status'), value: item.status },
                      { id: 'embargoUntil', label: t('repositoryItem.embargoUntil'), value: item.embargo_until ? formatDate(item.embargo_until) : null },
                    ] as Array<{ id: string; label: string; value: string | number | null }>).filter(r => r.value != null && r.value !== '').map(r => (
                      <div key={r.id} className="flex gap-4">
                        <span className="w-32 shrink-0 text-neutral-400 font-medium">{r.label}</span>
                        {r.id === 'DOI'
                          ? <a href={`https://doi.org/${r.value}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{String(r.value)}</a>
                          : <span className="text-neutral-800">{String(r.value)}</span>
                        }
                      </div>
                    ))}
                  </div>
                )}

                {/* Version History */}
                {activeTab === 'versions' && (
                  <div className="space-y-3">
                    {versions.length === 0 ? (
                      <p className="text-neutral-400 text-sm text-center py-4">{t('repositoryItem.noVersionHistory')}</p>
                    ) : (
                      versions.map((v: VersionRow) => (
                        <div key={v.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                          <div>
                            <p className="text-sm font-semibold text-neutral-800">{t('repositoryItem.version', { version: v.version_number })}</p>
                            {v.change_note && <p className="text-xs text-neutral-500 mt-0.5">{v.change_note}</p>}
                            <p className="text-xs text-neutral-400 mt-0.5">{formatDate(v.created_at, 'long')}</p>
                          </div>
                          {v.file_url && (
                            <a href={v.file_url} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs py-1 px-2">
                              {t('repositoryItem.download')}
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
                        <h4 className="font-semibold text-sm text-neutral-700">{myReview ? t('repositoryItem.yourReview') : t('repositoryItem.writeReview')}</h4>
                        <div className="flex items-center gap-2">
                          <Stars rating={reviewRating} onClick={setReviewRating} />
                          {reviewRating > 0 && (
                            <span className="text-xs text-neutral-500">{t(RATING_KEYS[reviewRating - 1])}</span>
                          )}
                        </div>
                        <textarea value={reviewBody} onChange={e => setReviewBody(e.target.value)}
                          placeholder={t('repositoryItem.shareThoughts')} rows={3} className="input w-full resize-none text-sm" />
                        <div className="flex justify-end">
                          <button onClick={submitReview} disabled={!reviewRating || submittingReview}
                            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                            {submittingReview ? t('repositoryItem.saving') : myReview ? t('repositoryItem.updateReview') : t('repositoryItem.submitReview')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-neutral-50 rounded-xl p-4">
                        <Link to="/login" className="btn-outline text-sm">{t('repositoryItem.signInToReview')}</Link>
                      </div>
                    )}
                    {reviews.length === 0
                      ? <p className="text-neutral-400 text-sm text-center py-4">{t('repositoryItem.noReviewsYet')}</p>
                      : reviews.map((r: ReviewRow) => (
                        <div key={r.id} className="flex gap-3">
                          <Initials name={r.patron_name ?? '?'} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-neutral-700">{r.patron_name ?? t('repositoryItem.anonymous')}</span>
                              <Stars rating={r.rating} />
                              <span className="text-xs text-neutral-400">{formatDate(r.created_at)}</span>
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
                    {discussions.length === 0 && <p className="text-neutral-400 text-sm">{t('repositoryItem.noDiscussionYet')}</p>}
                    {discussions.map(d => (
                      <div key={d.id} className="flex gap-3">
                        <Initials name={d.patron_name ?? '?'} />
                        <div className="flex-1 bg-neutral-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1 justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-neutral-700">{d.patron_name ?? t('repositoryItem.anonymous')}</span>
                              <span className="text-xs text-neutral-400">{formatDate(d.created_at)}</span>
                            </div>
                            {user && <button onClick={() => setReplyTo(v => v === d.id ? null : d.id)} className="text-xs text-primary-600 hover:underline">{t('repositoryItem.reply')}</button>}
                          </div>
                          <p className="text-sm text-neutral-700">{d.body}</p>
                          {replyTo === d.id && (
                            <div className="mt-3 flex gap-2">
                              <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && submitComment()}
                                placeholder={t('repositoryItem.writeReply')} className="input flex-1 text-xs py-1.5" />
                              <button onClick={submitComment} disabled={!newComment.trim() || submittingComment}
                                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">{t('repositoryItem.post')}</button>
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
                            placeholder={t('repositoryItem.sharePlaceholder')} rows={3} className="input w-full resize-none text-sm" />
                          <div className="flex justify-end mt-2">
                            <button onClick={submitComment} disabled={!newComment.trim() || submittingComment}
                              className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                              {submittingComment ? t('repositoryItem.posting') : t('repositoryItem.postComment')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : !user && (
                      <div className="border-t border-neutral-100 pt-4">
                        <Link to="/login" className="btn-outline text-sm">{t('repositoryItem.signInToDiscussion')}</Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Annotations */}
                {activeTab === 'annotations' && (
                  <div className="space-y-5">
                    {user ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                        <h4 className="font-semibold text-sm text-amber-800">{t('repositoryItem.addAnnotation')}</h4>
                        <div>
                          <label className="text-xs font-medium text-neutral-600 mb-1 block">{t('repositoryItem.highlightedText')}</label>
                          <textarea value={newHighlight} onChange={e => setNewHighlight(e.target.value)}
                            placeholder={t('repositoryItem.pastePassage')}
                            rows={2} className="input w-full resize-none text-sm bg-white" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-600 mb-1 block">{t('repositoryItem.yourComment')}</label>
                          <textarea value={newAnnotation} onChange={e => setNewAnnotation(e.target.value)}
                            placeholder={t('repositoryItem.writeNote')}
                            rows={2} className="input w-full resize-none text-sm bg-white" />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={annotationPrivate} onChange={e => setAnnotationPrivate(e.target.checked)} className="rounded" />
                            <span className="text-neutral-600 text-xs">{t('repositoryItem.privateNote')}</span>
                          </label>
                          <button onClick={submitAnnotation} disabled={!newHighlight.trim() || submittingAnnotation}
                            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                            {submittingAnnotation ? t('repositoryItem.saving') : t('repositoryItem.saveAnnotation')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <Link to="/login" className="btn-outline text-sm">{t('repositoryItem.signInToAnnotate')}</Link>
                      </div>
                    )}
                    {annotations.length === 0
                      ? <p className="text-neutral-400 text-sm text-center py-4">{t('repositoryItem.noAnnotationsYet')}</p>
                      : annotations.map((a: AnnotationRow) => (
                        <div key={a.id} className="border border-amber-200 rounded-xl overflow-hidden">
                          <div className="bg-amber-50 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Initials name={a.patron_name ?? '?'} />
                              <span className="text-xs font-semibold text-neutral-700">{a.patron_name ?? t('repositoryItem.anonymous')}</span>
                              <span className="text-xs text-neutral-400">{formatDate(a.created_at)}</span>
                            </div>
                            {a.is_private && <span className="badge text-xs">{t('repositoryItem.private')}</span>}
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
                          {t(CITATION_KEYS[s])}
                        </button>
                      ))}
                    </div>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm leading-relaxed text-neutral-700">
                      {generateCitation(activeCitation)}
                    </div>
                    <button onClick={handleCopyCitation} className="btn-outline text-sm">
                      {copied ? t('repositoryItem.copiedToClipboard') : t('repositoryItem.copyCitation')}
                    </button>
                    {item.status === 'published' && item.visibility === 'global' && (
                      <div className="flex gap-2 pt-1">
                        <a
                          href={`/api/repository/${encodeURIComponent(item.id)}/citation?format=bibtex`}
                          className="btn-outline text-sm"
                          download
                        >
                          BibTeX
                        </a>
                        <a
                          href={`/api/repository/${encodeURIComponent(item.id)}/citation?format=ris`}
                          className="btn-outline text-sm"
                          download
                        >
                          RIS
                        </a>
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
