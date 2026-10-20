import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { usePageTitle } from '@/hooks/usePageTitle';

type CitationStyle = 'apa' | 'harvard' | 'mla' | 'chicago';

const CITATION_KEYS: Record<CitationStyle, TranslationKey> = {
  apa: 'repositoryItem.apa',
  harvard: 'repositoryItem.harvard',
  mla: 'repositoryItem.mla',
  chicago: 'repositoryItem.chicago',
};

interface ThesisDetailData {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string[];
  degree: string;
  department: string;
  faculty: string | null;
  programme: string | null;
  supervisor: string;
  co_supervisors: Array<{ name?: string }>;
  submission_type: string;
  language: string | null;
  year: number;
  pages: number | null;
  session: string | null;
  reference_no: string | null;
  doi: string | null;
  status: string;
  student_name: string | null;
  repository_item_id: string | null;
  created_at: string;
  updated_at: string;
  embargo_until: string | null;
  has_file: boolean;
  file_available: boolean;
}

interface ThesisApiResponse {
  success: boolean;
  data?: ThesisDetailData;
  error?: string;
}

function buildCitation(thesis: ThesisDetailData, style: CitationStyle, origin: string): string {
  const author = (thesis.student_name ?? '').trim();
  const year = thesis.year ? String(thesis.year) : 'n.d.';
  const ref = thesis.doi ? `https://doi.org/${thesis.doi}` : `${origin}/theses/${thesis.id}`;
  switch (style) {
    case 'apa':
      return author
        ? `${author} (${year}). ${thesis.title}. Retrieved from ${ref}`
        : `(${year}). ${thesis.title}. Retrieved from ${ref}`;
    case 'harvard':
      return author
        ? `${author}, ${year}. ${thesis.title}. Available at: ${ref}`
        : `${year}. ${thesis.title}. Available at: ${ref}`;
    case 'mla':
      return `${author ? `${author}. ` : ''}"${thesis.title}." ${year}. ${ref}`;
    case 'chicago':
      return `${author ? `${author}. ` : ''}"${thesis.title}." ${year}. Accessed from ${ref}`;
  }
}

export default function ThesisDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, formatDate } = useI18n();
  const [thesis, setThesis] = useState<ThesisDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCitation, setActiveCitation] = useState<CitationStyle>('apa');
  const [copied, setCopied] = useState(false);

  usePageTitle(loading ? t('thesisDetail.pageTitle') : thesis?.title ?? t('thesisDetail.pageTitle'));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const response = await fetch(`/api/theses/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
        const payload = (await response.json()) as ThesisApiResponse;
        if (cancelled) return;
        if (!response.ok || !payload.success || !payload.data) {
          setNotFound(true);
          setThesis(null);
        } else {
          setThesis(payload.data);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setThesis(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleCopyCitation = () => {
    if (!thesis) return;
    void navigator.clipboard
      .writeText(buildCitation(thesis, activeCitation, window.location.origin))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  if (loading) {
    return (
      <div className="section py-16">
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !thesis) {
    return (
      <div className="section py-20 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">🎓</div>
        <p className="text-neutral-600 font-medium mb-6">{t('thesisDetail.notFound')}</p>
        <Link to="/theses" className="btn-primary">{t('thesisDetail.backToTheses')}</Link>
      </div>
    );
  }

  const embargoActive = Boolean(thesis.embargo_until && new Date(thesis.embargo_until).getTime() > Date.now());

  return (
    <div>
      <div className="page-header">
        <div className="section py-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span aria-hidden="true">›</span>
              <Link to="/theses" className="hover:text-white transition-colors">{t('thesisDetail.backToTheses')}</Link>
              <span aria-hidden="true">›</span>
              <span>{t('thesisDetail.submissionType')}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">{thesis.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/75">
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-semibold">{thesis.degree}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-semibold">{thesis.year}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-semibold">{thesis.submission_type}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section py-10">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-neutral-100 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">{t('repositoryItem.metadata')}</h2>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {thesis.student_name && (
                  <div>
                    <dt className="font-medium text-neutral-500">{t('thesisDetail.author')}</dt>
                    <dd className="text-neutral-900">{thesis.student_name}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-neutral-500">{t('thesisDetail.supervisor')}</dt>
                  <dd className="text-neutral-900">{thesis.supervisor}</dd>
                </div>
                {thesis.co_supervisors.length > 0 && (
                  <div>
                    <dt className="font-medium text-neutral-500">{t('thesisDetail.coSupervisors')}</dt>
                    <dd className="text-neutral-900">{thesis.co_supervisors.map((s) => s.name).filter(Boolean).join(', ')}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-neutral-500">{t('thesisDetail.degree')}</dt>
                  <dd className="text-neutral-900">{thesis.degree}</dd>
                </div>
                {thesis.programme && (
                  <div>
                    <dt className="font-medium text-neutral-500">{t('thesisDetail.programme')}</dt>
                    <dd className="text-neutral-900">{thesis.programme}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-neutral-500">{t('repositoryItem.department')}</dt>
                  <dd className="text-neutral-900">{thesis.department}</dd>
                </div>
                {thesis.faculty && (
                  <div>
                    <dt className="font-medium text-neutral-500">{t('repositoryItem.faculty')}</dt>
                    <dd className="text-neutral-900">{thesis.faculty}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-neutral-500">{t('thesisDetail.year')}</dt>
                  <dd className="text-neutral-900">{thesis.year}</dd>
                </div>
                {thesis.session && (
                  <div>
                    <dt className="font-medium text-neutral-500">{t('thesisDetail.session')}</dt>
                    <dd className="text-neutral-900">{thesis.session}</dd>
                  </div>
                )}
                {thesis.pages && (
                  <div>
                    <dt className="font-medium text-neutral-500">{t('thesisDetail.pages')}</dt>
                    <dd className="text-neutral-900">{thesis.pages}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-neutral-500">{t('thesisDetail.language')}</dt>
                  <dd className="text-neutral-900">{thesis.language ?? 'English'}</dd>
                </div>
                {thesis.reference_no && (
                  <div>
                    <dt className="font-medium text-neutral-500">{t('thesisDetail.referenceNo')}</dt>
                    <dd className="text-neutral-900 font-mono text-xs">{thesis.reference_no}</dd>
                  </div>
                )}
                {thesis.doi && (
                  <div>
                    <dt className="font-medium text-neutral-500">DOI</dt>
                    <dd>
                      <a
                        href={`https://doi.org/${thesis.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-700 hover:underline break-all"
                      >
                        {thesis.doi}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-white border border-neutral-100 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-3">{t('repositoryItem.abstract')}</h2>
              <p className="text-sm text-neutral-700 leading-relaxed">
                {thesis.abstract ?? t('repositoryItem.noAbstract')}
              </p>
            </div>

            {thesis.keywords.length > 0 && (
              <div className="bg-white border border-neutral-100 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-neutral-900 mb-3">{t('common.keywords')}</h2>
                <div className="flex flex-wrap gap-2">
                  {thesis.keywords.map((keyword) => (
                    <Link
                      key={keyword}
                      to={`/search/global?q=${encodeURIComponent(keyword)}`}
                      className="text-xs bg-neutral-50 border border-neutral-200 text-neutral-600 px-2.5 py-1 rounded-full hover:border-primary-300 hover:text-primary-700 transition-colors"
                    >
                      {keyword}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-neutral-100 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-3">{t('repositoryItem.access')}</h2>
              {!thesis.has_file ? (
                <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-100 rounded-lg p-3">
                  {t('thesisDetail.noFile')}
                </p>
              ) : embargoActive ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {t('thesisDetail.embargoed', { date: thesis.embargo_until ? formatDate(thesis.embargo_until, 'long') : '' })}
                </p>
              ) : (
                <p className="text-sm text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-lg p-3">
                  {t('thesisDetail.signInForFile')}{' '}
                  <Link to="/login" className="text-primary-700 hover:underline font-medium">{t('common.signIn')}</Link>
                </p>
              )}

              {thesis.repository_item_id && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <p className="text-sm text-neutral-600 mb-2">{t('thesisDetail.inRepository')}</p>
                  <Link to={`/repository/${thesis.repository_item_id}`} className="btn-outline text-xs px-4 py-2 inline-block">
                    {t('thesisDetail.viewRepositoryRecord')}
                  </Link>
                </div>
              )}
            </div>

            <div className="bg-white border border-neutral-100 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-3">{t('thesisDetail.citeThisRecord')}</h2>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {(['apa', 'harvard', 'mla', 'chicago'] as CitationStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setActiveCitation(style)}
                    aria-pressed={activeCitation === style}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors uppercase ${
                      activeCitation === style ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {t(CITATION_KEYS[style])}
                  </button>
                ))}
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm leading-relaxed text-neutral-700">
                {buildCitation(thesis, activeCitation, window.location.origin)}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" onClick={handleCopyCitation} className="btn-outline text-sm">
                  {copied ? t('repositoryItem.copiedToClipboard') : t('repositoryItem.copyCitation')}
                </button>
                <a href={`/api/theses/${encodeURIComponent(thesis.id)}/citation?format=bibtex`} className="btn-outline text-sm" download>
                  BibTeX
                </a>
                <a href={`/api/theses/${encodeURIComponent(thesis.id)}/citation?format=ris`} className="btn-outline text-sm" download>
                  RIS
                </a>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-3">{t('thesisDetail.findRelated')}</h2>
              <Link to={`/search/global?q=${encodeURIComponent(thesis.title)}`} className="btn-outline text-sm inline-block">
                {t('thesisDetail.findRelated')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
