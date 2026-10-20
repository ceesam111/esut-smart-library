import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { VisibilityDiagnostics, MetadataGaps, CrawlCheck } from '@/server/visibility/visibilityDiagnostics';

const GAP_LABELS: Array<{ key: keyof MetadataGaps; labelKey: 'repositoryItem.abstract' | 'common.keywords' | 'thesisDetail.year' | 'thesisDetail.author' | 'common.doi' | 'common.license' | 'thesisDetail.language' | 'visibility.handle' | 'common.file' }> = [
  { key: 'missing_abstract', labelKey: 'repositoryItem.abstract' },
  { key: 'missing_keywords', labelKey: 'common.keywords' },
  { key: 'missing_year', labelKey: 'thesisDetail.year' },
  { key: 'missing_authors', labelKey: 'thesisDetail.author' },
  { key: 'missing_doi', labelKey: 'common.doi' },
  { key: 'missing_license', labelKey: 'common.license' },
  { key: 'missing_language', labelKey: 'thesisDetail.language' },
  { key: 'missing_handle', labelKey: 'visibility.handle' },
  { key: 'missing_file', labelKey: 'common.file' },
];

function statusClass(status: CrawlCheck['status']): string {
  if (status === 'ok') return 'bg-emerald-100 text-emerald-700';
  if (status === 'error') return 'bg-red-100 text-red-700';
  return 'bg-neutral-100 text-neutral-500';
}

export default function Visibility() {
  const { loading: authLoading } = useAuth();
  const { t, formatDate, formatNumber } = useI18n();
  const [diagnostics, setDiagnostics] = useState<VisibilityDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');

  usePageTitle(t('visibility.title'));

  const authFetch = useCallback(async (url: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('You must be signed in.');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}`, accept: 'application/json' } });
    const payload = (await response.json().catch(() => ({}))) as { success?: boolean; data?: VisibilityDiagnostics; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error || `Request failed with ${response.status}`);
    }
    return payload.data;
  }, []);

  const load = useCallback(async (deep: boolean) => {
    setWorking(deep ? 'deep' : 'refresh');
    setMessage('');
    try {
      const data = await authFetch(`/api/admin/visibility${deep ? '?deep=1' : ''}`);
      setDiagnostics(data);
    } catch (error) {
      setMessage(`${t('visibility.loadFailed')} ${error instanceof Error ? error.message : ''}`.trim());
    } finally {
      setWorking('');
      setLoading(false);
    }
  }, [authFetch, t]);

  useEffect(() => { if (!authLoading) void load(false); }, [authLoading, load]);

  const repo = diagnostics?.repository;
  const gaps = diagnostics?.metadata_gaps;
  const indexable = repo?.public_indexable_items ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t('visibility.title')}</h1>
          <p className="text-sm text-neutral-500">{t('visibility.subtitle')}</p>
          {diagnostics && (
            <p className="text-[11px] text-neutral-400 mt-1">
              {t('visibility.generatedAt')} {formatDate(diagnostics.generated_at, 'long')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={working !== ''}
            className="btn-outline text-xs px-3 py-2 disabled:opacity-50"
          >
            {t('visibility.refresh')}
          </button>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={working !== ''}
            className="btn-primary text-xs px-3 py-2 disabled:opacity-50"
          >
            {working === 'deep' ? t('visibility.loading') : t('visibility.runDeep')}
          </button>
        </div>
      </div>

      {message && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</div>}

      {loading && !diagnostics && <p className="text-sm text-neutral-500">{t('visibility.loading')}</p>}

      {repo && gaps && (
        <>
          <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: t('visibility.publishedItems'), value: repo.published_items },
              { label: t('visibility.indexableItems'), value: repo.public_indexable_items },
              { label: t('visibility.embargoedItems'), value: repo.embargoed_items },
              { label: t('visibility.nonPublicPublished'), value: repo.non_public_published_items },
              { label: t('visibility.publishedTheses'), value: repo.published_theses },
              { label: t('visibility.sitemapCoverage'), value: `${repo.sitemap_coverage_pct}%` },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="text-xs font-semibold text-neutral-500">{card.label}</div>
                <div className="text-2xl font-bold text-neutral-900 mt-1">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold text-neutral-900">{t('visibility.sitemapCoverage')}</h2>
              <span className="text-xs text-neutral-500">
                {formatNumber(repo.sitemap_urls)} / {formatNumber(repo.public_indexable_items)} {t('visibility.records')}
                {' · '}
                {t('visibility.sitemapCapacity')} {formatNumber(repo.sitemap_capacity)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden" role="progressbar" aria-valuenow={repo.sitemap_coverage_pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('visibility.sitemapCoverage')}>
              <div
                className={`h-full ${repo.sitemap_coverage_pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${repo.sitemap_coverage_pct}%` }}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900 mb-3">{t('visibility.metadataGaps')}</h2>
              <ul className="space-y-2 text-sm">
                {GAP_LABELS.map((gap) => {
                  const missing = gaps[gap.key];
                  const pct = indexable > 0 ? Math.round((missing / indexable) * 100) : 0;
                  return (
                    <li key={gap.key} className="flex items-center justify-between gap-3">
                      <span className="text-neutral-600">{t(gap.labelKey)}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${missing === 0 ? 'bg-emerald-100 text-emerald-700' : pct > 50 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                        {formatNumber(missing)} · {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900 mb-3">{t('visibility.duplicateTitles')}</h2>
              {diagnostics && diagnostics.duplicate_titles.length === 0 ? (
                <p className="text-sm text-emerald-700">{t('visibility.noDuplicates')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {diagnostics?.duplicate_titles.map((entry) => (
                    <li key={entry.title} className="flex items-start justify-between gap-3">
                      <span className="text-neutral-700 line-clamp-2">{entry.title}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                        {entry.count} {t('visibility.occurrences')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900 mb-3">{t('visibility.crawlability')}</h2>
              <ul className="space-y-2 text-sm">
                {[{ label: t('visibility.robotsTxt'), check: diagnostics?.crawlability.robots_txt }, { label: t('visibility.sitemapIndex'), check: diagnostics?.crawlability.sitemap_index }].map((row) => (
                  <li key={row.label} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-neutral-600 font-mono text-xs">{row.label}</span>
                    {row.check && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass(row.check.status)}`}>
                        {row.check.status}{row.check.code ? ` · ${row.check.code}` : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-neutral-400 mt-3">{t('visibility.deepHint')}</p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900 mb-3">{t('visibility.brokenLinks')}</h2>
              {diagnostics && diagnostics.broken_links.status !== 'ok' ? (
                <p className="text-sm text-neutral-500">{diagnostics.broken_links.detail}</p>
              ) : diagnostics && diagnostics.broken_links.broken.length === 0 ? (
                <p className="text-sm text-emerald-700">{t('visibility.noBrokenLinks')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {diagnostics?.broken_links.broken.slice(0, 10).map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-neutral-700 break-all">{entry.doi}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">{entry.code ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
              {diagnostics && diagnostics.broken_links.unverifiable > 0 && (
                <p className="text-[11px] text-neutral-400 mt-3">
                  {formatNumber(diagnostics.broken_links.unverifiable)} {t('visibility.unverifiable')}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-neutral-900">{t('visibility.searchConsole')}</h2>
                <p className="text-xs text-neutral-500 mt-1">{diagnostics?.search_console.note}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                {t('visibility.notConfigured')}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
