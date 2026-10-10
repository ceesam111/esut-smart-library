import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { trackClientEvent } from '@/lib/analytics';
import { institutionConfig } from '@config/institution.config';
import QRCode from 'qrcode';
import BackButton from '@/components/BackButton';
import BookCover from '@/components/BookCover';
import { useI18n, type TranslationKey } from '@/lib/i18n';

type CitationStyle = 'APA' | 'Harvard' | 'MLA' | 'Chicago';
type ActiveTab = 'details' | 'reviews' | 'citations' | 'discussion';
type CatalogueAction = 'reserve' | 'borrow' | 'return';

const RATING_KEYS: TranslationKey[] = [
  'catalogueItem.ratingPoor',
  'catalogueItem.ratingFair',
  'catalogueItem.ratingGood',
  'catalogueItem.ratingVeryGood',
  'catalogueItem.ratingExcellent',
];

const CITATION_KEYS: Record<CitationStyle, TranslationKey> = {
  APA: 'catalogueItem.apa',
  Harvard: 'catalogueItem.harvard',
  MLA: 'catalogueItem.mla',
  Chicago: 'catalogueItem.chicago',
};

interface CatalogueItemData {
  id: string;
  title: string;
  authors: string[] | string | null;
  year: string | number | null;
  publisher: string | null;
  place_of_publication: string | null;
  edition: string | null;
  subjects: string[] | null;
  call_number: string | null;
  format: string | null;
  language: string | null;
  series: string | null;
  abstract: string | null;
  physical_description: string | null;
  notes: string | null;
  isbn: string | null;
  cover_image: string | null;
  faculty_code: string | null;
  available_copies: number;
  total_copies: number;
  download_count: number;
  view_count: number;
}

interface CatalogueCopyData {
  id: string;
  shelf_location: string | null;
  shelf_code: string | null;
  faculty_code: string | null;
  branch: string | null;
  status: string;
}

interface DiscussionData {
  id: string;
  patron_name: string | null;
  body: string;
  created_at: string;
}

interface ReviewData {
  id: string;
  user_id: string | null;
  rating: number;
  body: string | null;
  patron_name: string | null;
  created_at: string;
}

interface PatronData {
  id: string;
  full_name: string;
  phone: string | null;
  department: string | null;
  library_number: string | null;
  patron_id: string | null;
  faculty_code: string | null;
  profile_photo_url: string | null;
  patron_category: string | null;
}

interface ReadingListData {
  id: string;
  name: string;
}

interface ActiveLoanData {
  id: string;
  due_date: string | null;
  issued_at: string | null;
  checkout_date: string | null;
  status: string;
}

const DEFAULT_CIRCULATION_RULES = {
  reservation_expiry_days: 7,
  student_loan_days: 14,
  staff_loan_days: 30,
  fine_rate_per_day: 50,
  fine_grace_days: 0,
  fine_max_amount: 0,
  fines_suspended: false,
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildCitation(item: CatalogueItemData, style: CitationStyle): string {
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

function Stars({ rating, size = 'md', onClick }: { rating: number; size?: 'sm' | 'md'; onClick?: (n: number) => void }) {
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={!onClick}
          onClick={() => onClick?.(n)}
          className={`${sz} ${onClick ? 'cursor-pointer' : 'cursor-default'} transition-transform ${onClick ? 'hover:scale-110' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill={n <= rating ? '#F59E0B' : 'none'} stroke="#F59E0B" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      ))}
    </span>
  );
}

export default function CatalogueItem() {
  const { t, formatDate, formatNumber, formatCurrency } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<CatalogueItemData | null>(null);
  const [copies, setCopies] = useState<CatalogueCopyData[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [myReview, setMyReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>('details');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [patron, setPatron] = useState<PatronData | null>(null);
  // review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  // reading list
  const [readingLists, setReadingLists] = useState<ReadingListData[]>([]);
  const [addingToList, setAddingToList] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [reservationMsg, setReservationMsg] = useState('');
  const [actionModal, setActionModal] = useState<CatalogueAction | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [circulationRules, setCirculationRules] = useState(DEFAULT_CIRCULATION_RULES);
  const [activeLoan, setActiveLoan] = useState<ActiveLoanData | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.from('catalogue_items').select('*').eq('id', id!).maybeSingle();
      if (!data) {
        const { data: migrated } = await supabase.from('repository_items').select('id, handle').or(`legacy_catalog_id.eq.${id},id.eq.${id}`).maybeSingle();
        if (migrated) {
          await navigate(`/repository/${encodeURIComponent(migrated.handle ?? migrated.id)}`, { replace: true });
          return;
        }
      }
      setItem(data);

      if (data) {
        await supabase.from('catalogue_items').update({ view_count: (data.view_count ?? 0) + 1 }).eq('id', id!);
        void trackClientEvent({
          event_type: 'catalogue_view',
          entity_id: String(data.id),
          entity_type: 'catalogue_item',
          path: `/catalogue/${id}`,
        });
        const { data: copiesData } = await supabase.from('catalogue_copies').select('*').eq('item_id', id!);
        setCopies(copiesData ?? []);
        const url = window.location.href;
        const qr = await QRCode.toDataURL(url, { width: 120, margin: 1, color: { dark: '#6B1D2A' } });
        setQrUrl(qr);
      }

      const { data: disc } = await supabase
        .from('discussions')
        .select('*')
        .eq('item_type', 'catalogue')
        .eq('item_id', id!)
        .is('parent_id', null)
        .order('created_at', { ascending: true });
      setDiscussions(disc ?? []);

      const { data: revs } = await supabase
        .from('reviews')
        .select('*')
        .eq('item_type', 'catalogue')
        .eq('item_id', id!)
        .order('created_at', { ascending: false });
      setReviews(revs ?? []);
      if (revs && revs.length > 0) {
        setAvgRating(Math.round((revs.reduce((s: number, r: ReviewData) => s + r.rating, 0) / revs.length) * 10) / 10);
      }

      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        const { data: p } = await supabase.from('patrons').select('id, full_name, phone, department, library_number, patron_id, faculty_code, profile_photo_url, patron_category').eq('user_id', u.id).maybeSingle();
        setPatron(p);
        const existing = revs?.find((r: ReviewData) => r.user_id === u.id);
        if (existing) { setMyReview(existing); setReviewRating(existing.rating); setReviewBody(existing.body ?? ''); }
        const { data: lists } = await supabase.from('reading_lists').select('id, name').eq('patron_id', p?.id ?? '');
        setReadingLists(lists ?? []);
        if (p?.id && data?.id) {
          const { data: loan } = await supabase
            .from('loans')
            .select('id, due_date, issued_at, checkout_date, status')
            .eq('patron_id', p.id)
            .eq('catalogue_item_id', data.id)
            .eq('status', 'active')
            .order('due_date', { ascending: true })
            .limit(1)
            .maybeSingle();
          setActiveLoan(loan);
        }
      }

      const { data: rulesData } = await supabase.rpc('get_circulation_rules');
      if (rulesData) setCirculationRules({ ...DEFAULT_CIRCULATION_RULES, ...rulesData });

      setLoading(false);
    };
    void init();
  }, [id, navigate]);

  const openAction = (action: CatalogueAction) => {
    if (!user) { window.location.href = '/login'; return; }
    if (!patron?.id) return;
    setReservationMsg('');
    setActionModal(action);
  };

  const submitCatalogueAction = async () => {
    if (!actionModal || !patron?.id) return;
    setSubmittingAction(true);
    const { data, error } = await supabase.rpc('create_catalogue_item_request', { item_id: id, request_action: actionModal });
    setSubmittingAction(false);
    if (error) {
      setReservationMsg(t('catalogueItem.reservationFailed', { message: error.message }));
      return;
    }
    const expires = data?.[0]?.expires_at ? formatDate(data[0].expires_at) : t('catalogueItem.oneWeek');
    const label = actionModal === 'reserve' ? t('catalogueItem.reserveLabel') : actionModal === 'borrow' ? t('catalogueItem.borrowLabel') : t('catalogueItem.returnLabel');
    setActionModal(null);
    setReservationMsg(t('catalogueItem.submittedMsg', { label, expires }));
  };

  const handleCopyDownload = async () => {
    await supabase.from('catalogue_items').update({ download_count: (item?.download_count ?? 0) + 1 }).eq('id', id!);
    setItem((prev) => (prev ? { ...prev, download_count: (prev.download_count ?? 0) + 1 } : prev));
  };

  const submitComment = async () => {
    if (!newComment.trim() || !user) return;
    setSubmittingComment(true);
    const { data, error } = await supabase.from('discussions').insert({
      item_type: 'catalogue', item_id: id,
      user_id: user.id, patron_name: patron?.full_name ?? user.email,
      body: newComment.trim(), parent_id: replyTo ?? null,
    }).select().single();
    if (!error && data) {
      setDiscussions(prev => [...prev, data]);
      setNewComment('');
      setReplyTo(null);
    }
    setSubmittingComment(false);
  };

  const submitReview = async () => {
    if (!reviewRating || !user) return;
    setSubmittingReview(true);
    const payload = {
      user_id: user.id, patron_name: patron?.full_name ?? user.email,
      item_type: 'catalogue', item_id: id,
      rating: reviewRating, body: reviewBody.trim() || null,
    };
    let saved: ReviewData;
    if (myReview) {
      const { data } = await supabase.from('reviews').update({ rating: reviewRating, body: reviewBody.trim() || null }).eq('id', myReview.id).select().single();
      saved = data;
      setReviews(prev => prev.map(r => r.id === myReview.id ? saved : r));
    } else {
      const { data } = await supabase.from('reviews').insert(payload).select().single();
      saved = data;
      if (saved) setReviews(prev => [saved, ...prev]);
      // fire feed event
      supabase.from('feed_events').insert({
        user_id: user.id, patron_name: patron?.full_name ?? user.email,
        faculty_code: patron?.faculty_code ?? null,
        event_type: 'review_created',
        payload: { item_type: 'catalogue', item_id: id, item_title: item?.title, rating: reviewRating },
      });
    }
    if (saved) {
      setMyReview(saved);
      const all = myReview ? reviews.map(r => r.id === myReview.id ? saved : r) : [saved, ...reviews];
      setAvgRating(Math.round((all.reduce((s: number, r: ReviewData) => s + r.rating, 0) / all.length) * 10) / 10);
    }
    setSubmittingReview(false);
  };

  const addToReadingList = async (listId: string, listName: string) => {
    if (!user) return;
    setAddingToList(true);
    await supabase.from('reading_list_items').upsert({
      reading_list_id: listId, catalogue_item_id: id,
      item_type: 'catalogue', item_title: item?.title,
      item_authors: Array.isArray(item?.authors) ? item.authors.join('; ') : (item?.authors ?? ''),
    }, { onConflict: 'reading_list_id,catalogue_item_id' });
    supabase.from('feed_events').insert({
      user_id: user.id, patron_name: patron?.full_name ?? user.email,
      faculty_code: patron?.faculty_code ?? null,
      event_type: 'list_item_added',
      payload: { item_type: 'catalogue', item_id: id, item_title: item?.title, list_name: listName },
    });
    setShowListMenu(false);
    setAddingToList(false);
  };

  const copyCitation = () => {
    void navigator.clipboard.writeText(buildCitation(item!, citationStyle));
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
          <p>{t('catalogueItem.itemNotFound')}</p>
          <Link to="/catalogue" className="btn-primary mt-4">{t('catalogueItem.backToCatalogue')}</Link>
        </div>
      </div>
    );
  }

  const subjects: string[] = Array.isArray(item.subjects) ? item.subjects : [];
  const today = new Date();
  const reservationExpiryDate = addDays(today, Number(circulationRules.reservation_expiry_days) || 7);
  const loanDays = String(patron?.patron_category ?? '').toLowerCase().includes('staff')
    ? Number(circulationRules.staff_loan_days) || 30
    : Number(circulationRules.student_loan_days) || 14;
  const borrowDueDate = addDays(today, loanDays);
  const returnDate = today;
  const activeLoanDueDate = activeLoan?.due_date ? new Date(activeLoan.due_date) : null;
  const overdueDays = activeLoanDueDate
    ? Math.max(0, Math.ceil((returnDate.getTime() - activeLoanDueDate.getTime()) / (24 * 60 * 60 * 1000)) - (Number(circulationRules.fine_grace_days) || 0))
    : 0;
  const rawFine = circulationRules.fines_suspended ? 0 : overdueDays * (Number(circulationRules.fine_rate_per_day) || 0);
  const estimatedFine = Number(circulationRules.fine_max_amount) > 0 ? Math.min(rawFine, Number(circulationRules.fine_max_amount)) : rawFine;

  // Group copies by their shelf_code (or fall back to faculty/branch/library label)
  interface LocationGroup {
    libraryName: string;
    shelfCode: string;
    floor: string;
    bay: string;
    shelf: string;
    subjectRange: string;
    available: number;
    total: number;
  }

  const locationGroups: LocationGroup[] = [];
  const locationMap: Record<string, LocationGroup> = {};

  copies.forEach((c) => {
    const sc: string = c.shelf_location ?? c.shelf_code ?? '';
    // Parse shelf code segments: e.g. BFL/F1/B02/SH01
    const parts = sc ? sc.split('/') : [];
    const libCode = parts[0] ?? '';
    const floor = parts[1] ?? '';
    const bay = parts[2] ?? '';
    const shelfNum = parts[3] ?? '';

    const key = sc || c.faculty_code || c.branch || 'Main Library';
    if (!locationMap[key]) {
      locationMap[key] = {
        libraryName: libCode
          ? ([institutionConfig.mainLibrary, ...institutionConfig.branchLibraries, ...institutionConfig.facultyLibraries].find((l) => l.code === libCode)?.name ?? libCode)
          : (c.faculty_code || c.branch || t('catalogueItem.mainLibrary')),
        shelfCode: sc,
        floor,
        bay,
        shelf: shelfNum,
        subjectRange: '',
        available: 0,
        total: 0,
      };
      locationGroups.push(locationMap[key]);
    }
    locationMap[key].total++;
    if (c.status === 'available') locationMap[key].available++;
  });

  const TABS: { key: ActiveTab; labelKey: TranslationKey; count?: number }[] = [
    { key: 'details', labelKey: 'catalogueItem.details' },
    { key: 'reviews', labelKey: 'catalogueItem.reviews', count: reviews.length },
    { key: 'citations', labelKey: 'catalogueItem.citations' },
    { key: 'discussion', labelKey: 'catalogueItem.discussion', count: discussions.length },
  ];

  return (
    <div className="pt-16 bg-neutral-50 min-h-screen">
      <div className="section py-8">
        <BackButton label={t('common.back')} />
        <Link to="/catalogue" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t('catalogueItem.backToCatalogue')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT PANEL */}
          <div className="space-y-4">
            <div className="card p-4">
              <BookCover
                coverImage={item.cover_image}
                isbn={item.isbn}
                title={item.title}
                format={item.format}
                className="w-full aspect-[3/4] bg-primary-50 rounded-xl flex items-center justify-center overflow-hidden mb-4"
                imgClassName="w-full h-full object-cover rounded-xl"
                variant="detail"
              />

              <div className="space-y-2 text-sm border-t border-neutral-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">{t('catalogueItem.callNo')}</span>
                  <span className="font-mono font-semibold text-primary-700 text-xs bg-primary-50 px-2 py-0.5 rounded">{item.call_number ?? t('catalogueItem.tbc')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">{t('catalogueItem.copies')}</span>
                  <span className={`font-semibold text-sm ${item.available_copies > 0 ? 'text-success-600' : 'text-error-600'}`}>
                    {t('catalogueItem.availableOfTotal', { available: item.available_copies, total: item.total_copies })}
                  </span>
                </div>
                {item.faculty_code && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">{t('catalogueItem.faculty')}</span>
                    <span className="text-neutral-700 text-xs">{item.faculty_code}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {item.available_copies > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => openAction('reserve')} className="btn-primary w-full">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                      {t('catalogueItem.reserveThisItem')}
                    </button>
                    <button onClick={() => openAction('borrow')} className="btn-secondary w-full">
                      {t('catalogueItem.borrowThisItem')}
                    </button>
                    <button onClick={() => openAction('return')} className="btn-outline w-full text-sm">
                      {t('catalogueItem.returnThisItem')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => openAction('reserve')} className="btn-primary w-full">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    {t('catalogueItem.reserveBorrowReturn')}
                  </button>
                )}
                {reservationMsg && (
                  <p className={`text-xs rounded-lg px-3 py-2 ${reservationMsg.startsWith(t('catalogueItem.reservationFailed', { message: '' })) ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700'}`}>
                    {reservationMsg}
                  </p>
                )}
                {item.format === 'E-Book' && (
                  <button onClick={handleCopyDownload} className="btn-secondary w-full">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    {t('catalogueItem.download')}
                  </button>
                )}

                {/* Add to reading list */}
                {user && readingLists.length > 0 && (
                  <div className="relative">
                    <button onClick={() => setShowListMenu(v => !v)}
                      disabled={addingToList}
                      className="btn-ghost w-full text-sm border border-neutral-200 disabled:opacity-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" /></svg>
                      {t('catalogueItem.addReadingList')}
                    </button>
                    {showListMenu && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-card-hover border border-neutral-100 z-10 overflow-hidden">
                        {readingLists.map((l) => (
                          <button key={l.id} onClick={() => addToReadingList(l.id, l.name)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700">
                            {l.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="card flex-1 p-3 flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <div>
                  <div className="font-semibold text-neutral-800">{formatNumber(((item.view_count ?? 0) + 1))}</div>
                  <div className="text-xs text-neutral-400">{t('catalogueItem.views')}</div>
                </div>
              </div>
              {(item.download_count ?? 0) > 0 && (
                <div className="card flex-1 p-3 flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <div>
                    <div className="font-semibold text-neutral-800">{formatNumber(item.download_count)}</div>
                    <div className="text-xs text-neutral-400">{t('catalogueItem.downloads')}</div>
                  </div>
                </div>
              )}
            </div>

            {qrUrl && (
              <div className="card p-4 flex flex-col items-center gap-2">
                <img src={qrUrl} alt="QR Code" className="w-24 h-24" />
                <p className="text-xs text-neutral-400 text-center">{t('catalogueItem.scanToShare')}</p>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="lg:col-span-2 space-y-4">

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

              {/* Average rating */}
              {reviews.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <Stars rating={Math.round(avgRating)} size="sm" />
                  <span className="text-sm font-semibold text-neutral-700">{avgRating}</span>
                  <span className="text-xs text-neutral-400">{t('catalogueItem.reviewCount', { count: reviews.length })}</span>
                </div>
              )}

              {subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {subjects.map((s: string) => (
                    <Link key={s} to={`/catalogue?subject=${encodeURIComponent(s)}`}
                      className="badge badge-secondary hover:bg-secondary-200 transition-colors cursor-pointer">{s}</Link>
                  ))}
                </div>
              )}
              {item.abstract && (
                <p className="mt-4 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-4">{item.abstract}</p>
              )}
            </div>

            {/* Physical Location Cards */}
            {(locationGroups.length > 0 || copies.length === 0) && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2">
                  <svg className="w-4 h-4 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="font-semibold text-neutral-800 text-sm">{t('catalogueItem.whereToFind')}</h3>
                </div>

                {item.format === 'E-Book' ? (
                  <div className="px-5 py-4">
                    <div className="inline-flex items-center gap-2 bg-success-50 border border-success-200 text-success-700 text-sm font-medium px-3 py-2 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                      </svg>
                      {t('catalogueItem.availableOnline')}
                    </div>
                  </div>
                ) : locationGroups.length > 0 ? (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {locationGroups.map((loc, i) => (
                      <div
                        key={i}
                        style={{ background: '#fdf2f4', borderColor: '#6B1D2A' }}
                        className="rounded-xl border p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm" style={{ color: '#6B1D2A' }}>{loc.libraryName}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${loc.available > 0 ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-600'}`}>
                            {loc.available > 0 ? t('catalogue.availableCount', { count: loc.available }) : t('catalogueItem.onLoan')}
                          </span>
                        </div>

                        {loc.shelfCode && (
                          <>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded" style={{ background: '#6B1D2A', color: '#fff' }}>
                                {loc.shelfCode}
                              </span>
                            </div>
                            {(loc.floor || loc.bay || loc.shelf) && (
                              <div className="flex items-center gap-1.5 text-xs text-neutral-600 flex-wrap">
                                {loc.floor && (
                                  <span className="bg-white/60 border border-white px-2 py-0.5 rounded">
                                    {t('catalogueItem.floor', { floor: loc.floor })}
                                  </span>
                                )}
                                {loc.bay && (
                                  <span className="bg-white/60 border border-white px-2 py-0.5 rounded">
                                    {t('catalogueItem.bay', { bay: loc.bay })}
                                  </span>
                                )}
                                {loc.shelf && (
                                  <span className="bg-white/60 border border-white px-2 py-0.5 rounded">
                                    {t('catalogueItem.shelf', { shelf: loc.shelf })}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        <div className="flex items-center gap-1 text-xs text-neutral-500 pt-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {t('catalogueItem.callNumber', { number: item.call_number ?? t('catalogueItem.tbc') })}
                          <span className="mx-1 text-neutral-300">·</span>
                          {t('catalogueItem.copiesCount', { count: loc.total })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4">
                    <div
                      style={{ background: '#fdf2f4', borderColor: '#6B1D2A' }}
                      className="rounded-xl border p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm" style={{ color: '#6B1D2A' }}>{t('catalogueItem.mainLibrary')}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${item.available_copies > 0 ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-600'}`}>
                          {item.available_copies > 0 ? t('catalogue.availableCount', { count: item.available_copies }) : t('catalogueItem.onLoan')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-neutral-500">
                        {t('catalogueItem.callNumber', { number: item.call_number ?? t('catalogueItem.tbc') })}
                        <span className="mx-1 text-neutral-300">·</span>
                        {t('catalogueItem.copiesCount', { count: item.total_copies })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="card overflow-hidden">
              <div className="flex border-b border-neutral-100 overflow-x-auto">
                {TABS.map(entry => (
                  <button key={entry.key} onClick={() => setTab(entry.key)}
                    className={`flex-1 min-w-max px-4 py-3 text-sm font-medium capitalize transition-colors relative whitespace-nowrap
                      ${tab === entry.key ? 'text-primary-700' : 'text-neutral-500 hover:text-neutral-700'}`}>
                    {t(entry.labelKey)}
                    {entry.count != null && entry.count > 0 && (
                      <span className="ml-1.5 bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">{entry.count}</span>
                    )}
                    {tab === entry.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* Details */}
                {tab === 'details' && (
                  <div className="text-sm space-y-3">
                    {[
                      { label: 'catalogueItem.isbn' as TranslationKey, value: item.isbn },
                      { label: 'catalogueItem.callNumberLabel' as TranslationKey, value: item.call_number },
                      { label: 'catalogueItem.publisher' as TranslationKey, value: item.publisher },
                      { label: 'catalogueItem.place' as TranslationKey, value: item.place_of_publication },
                      { label: 'catalogueItem.year' as TranslationKey, value: item.year },
                      { label: 'catalogueItem.edition' as TranslationKey, value: item.edition },
                      { label: 'catalogueItem.series' as TranslationKey, value: item.series },
                      { label: 'catalogueItem.language' as TranslationKey, value: item.language },
                      { label: 'catalogueItem.faculty' as TranslationKey, value: item.faculty_code ? institutionConfig.faculties.find((f) => f.code === item.faculty_code)?.name ?? item.faculty_code : null },
                      { label: 'catalogueItem.physicalDesc' as TranslationKey, value: item.physical_description },
                      { label: 'catalogueItem.notes' as TranslationKey, value: item.notes },
                    ].filter(r => r.value != null && r.value !== '').map(r => (
                      <div key={r.label} className="flex gap-4">
                        <span className="w-28 shrink-0 text-neutral-400 font-medium">{t(r.label)}</span>
                        <span className="text-neutral-800">{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reviews */}
                {tab === 'reviews' && (
                  <div className="space-y-5">
                    {/* Submit / edit review */}
                    {user ? (
                      <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                        <h4 className="font-semibold text-sm text-neutral-700">{myReview ? t('catalogueItem.yourReview') : t('catalogueItem.writeReview')}</h4>
                        <div className="flex items-center gap-2">
                          <Stars rating={reviewRating} onClick={setReviewRating} />
                          {reviewRating > 0 && (
                            <span className="text-xs text-neutral-500">{t(RATING_KEYS[reviewRating - 1])}</span>
                          )}
                        </div>
                        <textarea value={reviewBody} onChange={e => setReviewBody(e.target.value)}
                          placeholder={t('catalogueItem.shareThoughts')}
                          rows={3} className="input w-full resize-none text-sm" />
                        <div className="flex justify-end">
                          <button onClick={submitReview} disabled={!reviewRating || submittingReview}
                            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                            {submittingReview ? t('catalogueItem.saving') : myReview ? t('catalogueItem.updateReview') : t('catalogueItem.submitReview')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-neutral-50 rounded-xl p-4">
                        <Link to="/login" className="btn-outline text-sm">{t('catalogueItem.signInToReview')}</Link>
                      </div>
                    )}

                    {/* Review list */}
                    {reviews.length === 0 ? (
                      <p className="text-neutral-400 text-sm text-center py-4">{t('catalogueItem.noReviewsYet')}</p>
                    ) : (
                      <div className="space-y-4">
                        {reviews.map((r) => (
                          <div key={r.id} className="flex gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
                              {r.patron_name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-neutral-700">{r.patron_name ?? t('catalogueItem.anonymous')}</span>
                                <Stars rating={r.rating} size="sm" />
                                <span className="text-xs text-neutral-400">{formatDate(r.created_at)}</span>
                              </div>
                              {r.body && <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{r.body}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Citations */}
                {tab === 'citations' && (
                  <div>
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {(['APA', 'Harvard', 'MLA', 'Chicago'] as CitationStyle[]).map(c => (
                        <button key={c} onClick={() => setCitationStyle(c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                            ${citationStyle === c ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                          {t(CITATION_KEYS[c])}
                        </button>
                      ))}
                    </div>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm font-mono text-neutral-700 leading-relaxed">
                      {buildCitation(item, citationStyle)}
                    </div>
                    <button onClick={copyCitation} className="btn-ghost text-xs mt-2 flex items-center gap-1">
                      {copied
                        ? <><svg className="w-3.5 h-3.5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {t('catalogueItem.copied')}</>
                        : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> {t('catalogueItem.copyCitation')}</>
                      }
                    </button>
                  </div>
                )}

                {/* Discussion */}
                {tab === 'discussion' && (
                  <div className="space-y-4">
                    {discussions.length === 0 && (
                      <p className="text-neutral-400 text-sm">{t('catalogueItem.noDiscussionYet')}</p>
                    )}
                    {discussions.map(d => (
                      <div key={d.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {d.patron_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 bg-neutral-50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1 justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-neutral-700">{d.patron_name ?? t('catalogueItem.anonymous')}</span>
                              <span className="text-xs text-neutral-400">{formatDate(d.created_at)}</span>
                            </div>
                            {user && (
                              <button onClick={() => setReplyTo(r => r === d.id ? null : d.id)}
                                className="text-xs text-primary-600 hover:underline">{t('catalogueItem.reply')}</button>
                            )}
                          </div>
                          <p className="text-sm text-neutral-700">{d.body}</p>
                          {replyTo === d.id && (
                            <div className="mt-3 flex gap-2">
                              <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && submitComment()}
                                placeholder={t('catalogueItem.writeReply')} className="input flex-1 text-xs py-1.5" />
                              <button onClick={submitComment} disabled={!newComment.trim() || submittingComment}
                                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">{t('catalogueItem.post')}</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {user && !replyTo ? (
                      <div className="flex gap-3 pt-2 border-t border-neutral-100">
                        <div className="w-8 h-8 rounded-full bg-primary-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {patron?.full_name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                            placeholder={t('catalogueItem.sharePlaceholder')} rows={3} className="input w-full resize-none text-sm" />
                          <div className="flex justify-end mt-2">
                            <button onClick={submitComment} disabled={!newComment.trim() || submittingComment}
                              className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                              {submittingComment ? t('catalogueItem.posting') : t('catalogueItem.postComment')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : !user && (
                      <div className="border-t border-neutral-100 pt-4">
                        <Link to="/login" className="btn-outline text-sm">{t('catalogueItem.signInToDiscussion')}</Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl" id="catalogue-transaction-slip">
            <div className="bg-primary-800 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{t('catalogueItem.transactionSlip')}</p>
                  <h2 className="mt-1 text-2xl font-serif font-semibold">
                    {actionModal === 'reserve' ? t('catalogueItem.reserveItem') : actionModal === 'borrow' ? t('catalogueItem.borrowItem') : t('catalogueItem.returnItem')}
                  </h2>
                </div>
                <button onClick={() => setActionModal(null)} className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20">{t('catalogueItem.close')}</button>
              </div>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-[96px_1fr_1fr]">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white text-2xl text-neutral-400 sm:row-span-2">
                  {patron?.profile_photo_url ? <img src={patron.profile_photo_url} alt="" className="h-full w-full object-cover" /> : '👤'}
                </div>
                <div><p className="text-xs text-neutral-400">{t('catalogueItem.patronName')}</p><p className="font-semibold text-neutral-900">{patron?.full_name ?? user?.email ?? t('catalogueItem.signedInPatron')}</p></div>
                <div><p className="text-xs text-neutral-400">{t('catalogueItem.phoneNumber')}</p><p className="font-semibold text-neutral-900">{patron?.phone ?? t('catalogueItem.notSupplied')}</p></div>
                <div><p className="text-xs text-neutral-400">{t('catalogueItem.department')}</p><p className="font-semibold text-neutral-900">{patron?.department ?? t('catalogueItem.notSupplied')}</p></div>
                <div><p className="text-xs text-neutral-400">{t('catalogueItem.libraryCardNumber')}</p><p className="font-mono font-semibold text-primary-800">{patron?.library_number ?? patron?.patron_id ?? t('catalogueItem.notIssued')}</p></div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-primary-100 bg-primary-50 p-4 sm:grid-cols-[96px_1fr_1fr]">
                <div className="flex h-28 w-20 overflow-hidden rounded-xl bg-white shadow-sm sm:row-span-3">
                  <BookCover coverImage={item.cover_image} isbn={item.isbn} title={item.title} format={item.format} className="h-full w-full" imgClassName="h-full w-full object-cover" variant="card" />
                </div>
                <div className="sm:col-span-2"><p className="text-xs text-primary-700/70">{t('catalogueItem.bookItemTitle')}</p><p className="font-serif text-lg font-semibold text-primary-900">{item.title}</p></div>
                <div><p className="text-xs text-primary-700/70">{t('catalogueItem.authors')}</p><p className="text-sm font-medium text-primary-900">{Array.isArray(item.authors) ? item.authors.join('; ') : item.authors || t('catalogueItem.unknown')}</p></div>
                <div><p className="text-xs text-primary-700/70">{t('catalogueItem.callNumberLabel')}</p><p className="font-mono text-sm font-semibold text-primary-900">{item.call_number ?? t('catalogueItem.tbc')}</p></div>
                <div><p className="text-xs text-primary-700/70">{t('catalogueItem.availableCopies')}</p><p className="text-sm font-semibold text-primary-900">{item.available_copies} / {item.total_copies}</p></div>
                <div><p className="text-xs text-primary-700/70">{actionModal === 'return' ? t('catalogueItem.returnDate') : t('catalogueItem.requestDate')}</p><p className="text-sm font-semibold text-primary-900">{formatDate(today)}</p></div>
                {actionModal === 'reserve' && <div><p className="text-xs text-primary-700/70">{t('catalogueItem.reservationExpires')}</p><p className="text-sm font-semibold text-primary-900">{formatDate(reservationExpiryDate)}</p></div>}
                {actionModal === 'borrow' && <div><p className="text-xs text-primary-700/70">{t('catalogueItem.expectedDueDate')}</p><p className="text-sm font-semibold text-primary-900">{formatDate(borrowDueDate)}</p></div>}
                {actionModal === 'return' && <div><p className="text-xs text-primary-700/70">{t('catalogueItem.currentDueDate')}</p><p className="text-sm font-semibold text-primary-900">{activeLoanDueDate ? formatDate(activeLoanDueDate) : t('catalogueItem.notAvailable')}</p></div>}
              </div>

              {actionModal === 'return' && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                  <p className="font-semibold text-neutral-900">{t('catalogueItem.fineEstimate')}</p>
                  {activeLoanDueDate ? (
                    <p className="mt-1">{overdueDays > 0 ? t('catalogueItem.overdueCalc', {
                      days: overdueDays,
                      plural: overdueDays === 1 ? '' : 's',
                      rate: formatCurrency(Number(circulationRules.fine_rate_per_day)),
                      total: formatCurrency(estimatedFine),
                    }) : t('catalogueItem.noOverdueFine')}</p>
                  ) : (
                    <p className="mt-1">{t('catalogueItem.noActiveLoan')}</p>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {actionModal === 'reserve' && t('catalogueItem.reservationExpiryNote', { date: formatDate(reservationExpiryDate) })}
                {actionModal === 'borrow' && t('catalogueItem.borrowApprovalNote', {
                  date: formatDate(borrowDueDate),
                  rate: formatCurrency(Number(circulationRules.fine_rate_per_day)),
                  plural: Number(circulationRules.fine_grace_days) > 0 ? ` after ${circulationRules.fine_grace_days} grace day(s)` : '',
                })}
                {actionModal === 'return' && t('catalogueItem.returnNote')}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button onClick={() => setActionModal(null)} className="btn-outline">{t('catalogueItem.cancel')}</button>
                <button onClick={() => window.print()} className="btn-outline">{t('catalogueItem.printSlip')}</button>
                <button onClick={submitCatalogueAction} disabled={submittingAction} className="btn-primary disabled:opacity-50">
                  {submittingAction ? t('catalogueItem.submitting') : actionModal === 'reserve' ? t('catalogueItem.submitReservation') : actionModal === 'borrow' ? t('catalogueItem.submitBorrowRequest') : t('catalogueItem.submitReturnRequest')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
