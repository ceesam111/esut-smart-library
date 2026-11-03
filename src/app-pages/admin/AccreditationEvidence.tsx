import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import type { AccreditationDatabase } from '@/data/accreditation/databases';
import type { ProgrammeSubjectNode } from '@/data/accreditation/programmes';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import {
  fetchAccreditationSyncStatus,
  fetchEvidence,
  fetchProgrammes,
  triggerAccreditationSync,
  triggerAccreditationVerify,
  type EvidenceResponseData,
  type EvidenceStatus,
  type ProgrammeWithStats,
  type SyncResponseData,
  type SyncStatusResponseData,
  type VerifyResponseData,
} from '@/lib/accreditationApi';

type EvidenceTab = 'overview' | 'programmes' | 'sources' | 'samples';

const TABS: Array<{ id: EvidenceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'programmes', label: 'By programme' },
  { id: 'sources', label: 'Sources and sync' },
  { id: 'samples', label: 'Sample citations' },
];

const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  verified: 'Verified',
  partially_verified: 'Partially verified',
  pending_review: 'Pending review',
  not_available: 'Not available',
};

const TOTAL_LABELS: Record<string, string> = {
  indexed: 'Records indexed (all time)',
  active: 'Active records',
  uniqueWorks: 'Unique works after de-duplication',
  recent2023: 'Records from 2023 onward',
  withFullText: 'Records with a full-text link',
  withDoi: 'Records with a DOI',
  verified: 'Links verified',
  unverified: 'Links not yet verified',
  failed: 'Links failed',
  stale: 'Links stale (recheck inconclusive)',
  catalogueMatches: 'Local catalogue records matched to programmes',
  repositoryMatches: 'Repository records matched to programmes',
  providersEnabled: 'Providers enabled',
  providersWithData: 'Providers with indexed data',
};

const authHeaders = async (): Promise<Record<string, string>> => {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
};

const formatDate = (value: string | null): string => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusTone = (status: string): string => {
  if (status === 'ok') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'rate_limited') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'error') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-neutral-100 text-neutral-600 border-neutral-200';
};

const evidenceTone = (status: EvidenceStatus): string => {
  if (status === 'verified') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'partially_verified') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (status === 'pending_review') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-neutral-100 text-neutral-600 border-neutral-200';
};

const countSubjects = (nodes: ProgrammeSubjectNode[]): number => {
  let count = 0;
  const walk = (list: ProgrammeSubjectNode[]) => {
    for (const node of list) {
      count += 1;
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return count;
};

const buildCsvRows = (
  evidence: EvidenceResponseData,
): Array<Record<string, string | number | null>> => {
  const rows: Array<Record<string, string | number | null>> = [];
  rows.push({
    section: 'Report',
    generated_at: evidence.generatedAt,
    note: 'Counts computed from indexed records. Programme and topic minimums are internal screening heuristics, not NUC quotas. Source-reported collection sizes are not captured; every figure is an actual indexed count.',
  });
  for (const [metric, value] of Object.entries(evidence.totals)) {
    rows.push({ section: 'Totals', metric: TOTAL_LABELS[metric] ?? metric, value });
  }
  for (const entry of evidence.byProgramme) {
    rows.push({
      section: 'Programme',
      programme: entry.name,
      slug: entry.slug,
      visit_start: entry.visitStart,
      visit_end: entry.visitEnd,
      indexed: entry.total,
      since_2023: entry.recent2023,
      verified_links: entry.verified,
      full_text_links: entry.fullText,
      ebooks: entry.byType['ebook'] ?? 0,
      ebooks_verified: entry.byTypeVerified['ebook'] ?? 0,
      research_articles: entry.byType['research_article'] ?? 0,
      research_articles_verified: entry.byTypeVerified['research_article'] ?? 0,
      open_access_journals: entry.openAccessJournals,
      failed_links: entry.failedLinks,
      evidence_status: EVIDENCE_STATUS_LABELS[entry.evidenceStatus],
      weak_subjects: entry.weakTopics.join('; '),
      warning: entry.warning,
    });
  }
  for (const provider of evidence.byProvider) {
    rows.push({
      section: 'Source',
      provider: provider.label,
      provider_id: provider.provider,
      indexed: provider.count,
      since_2023: provider.recent2023,
    });
  }
  for (const state of evidence.syncState) {
    rows.push({
      section: 'Sync state',
      provider: state.provider,
      programme: state.programme_slug,
      status: state.last_status,
      last_run_at: state.last_run_at,
      records_fetched: state.records_fetched,
      records_upserted: state.records_upserted,
      last_error: state.last_error,
    });
  }
  for (const sample of evidence.sampleRecords) {
    rows.push({
      section: 'Sample citation',
      title: sample.title,
      creators: sample.creators.join('; '),
      year: sample.year,
      source: sample.sourceLabel,
      doi: sample.doi,
      url: sample.landingUrl,
      verification: sample.verificationStatus,
      verification_checked_at: sample.verificationCheckedAt,
    });
  }
  return rows;
};

const downloadCsv = (evidence: EvidenceResponseData): void => {
  const csv = Papa.unparse(buildCsvRows(evidence));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `esut-accreditation-evidence-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const downloadPdf = (
  evidence: EvidenceResponseData,
  subjectTotals: Map<string, number>,
): void => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = 56;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 44) {
      doc.addPage();
      y = 56;
    }
  };

  doc.setFontSize(16);
  doc.text('ESUT Smart Library — 2026 NUC Accreditation Evidence Report', margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Generated: ${evidence.generatedAt}`, margin, y);
  y += 14;
  const disclaimer = doc.splitTextToSize(
    'All counts are computed from actual indexed records, not estimated. Programme and topic minimums are internal screening heuristics set by the library team, not NUC quotas. Source-reported collection sizes are not captured by the current integrations; every figure shown is an actual ESUT-indexed record count.',
    contentWidth,
  );
  doc.text(disclaimer, margin, y);
  y += disclaimer.length * 12 + 14;

  doc.setFontSize(12);
  doc.text('Collection totals', margin, y);
  y += 18;
  doc.setFontSize(10);
  for (const [metric, value] of Object.entries(evidence.totals)) {
    ensureSpace(15);
    doc.text(`${TOTAL_LABELS[metric] ?? metric}: ${value}`, margin, y);
    y += 13;
  }
  y += 12;

  doc.setFontSize(12);
  ensureSpace(30);
  doc.text('Coverage by programme', margin, y);
  y += 18;
  const columns = [margin, margin + 190, margin + 235, margin + 280, margin + 330, margin + 385, margin + 445];
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Programme', columns[0], y);
  doc.text('Indexed', columns[1], y);
  doc.text('2023+', columns[2], y);
  doc.text('Ebooks', columns[3], y);
  doc.text('Articles', columns[4], y);
  doc.text('Subjects', columns[5], y);
  doc.text('Status', columns[6], y);
  doc.setFont('helvetica', 'normal');
  y += 8;
  for (const entry of evidence.byProgramme) {
    ensureSpace(16);
    y += 13;
    const nameLines = doc.splitTextToSize(entry.name, 185);
    doc.text(String(nameLines[0] ?? ''), columns[0], y);
    doc.text(String(entry.total), columns[1], y);
    doc.text(String(entry.recent2023), columns[2], y);
    doc.text(String(entry.byType['ebook'] ?? 0), columns[3], y);
    doc.text(String(entry.byType['research_article'] ?? 0), columns[4], y);
    const covered = (subjectTotals.get(entry.slug) ?? 0) - entry.weakTopics.length;
    doc.text(`${covered}/${subjectTotals.get(entry.slug) ?? 0}`, columns[5], y);
    doc.text(EVIDENCE_STATUS_LABELS[entry.evidenceStatus], columns[6], y);
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
  }
  y += 16;

  doc.setFontSize(12);
  ensureSpace(30);
  doc.text('Sources', margin, y);
  y += 18;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Source', margin, y);
  doc.text('Indexed', margin + 320, y);
  doc.text('2023+', margin + 400, y);
  doc.setFont('helvetica', 'normal');
  for (const provider of evidence.byProvider) {
    ensureSpace(15);
    y += 13;
    doc.text(provider.label, margin, y);
    doc.text(String(provider.count), margin + 320, y);
    doc.text(String(provider.recent2023), margin + 400, y);
  }
  y += 18;

  doc.setFontSize(12);
  ensureSpace(30);
  doc.text('Sample bibliographic citations with access verification', margin, y);
  y += 18;
  for (const sample of evidence.sampleRecords) {
    ensureSpace(58);
    doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(sample.title, contentWidth);
    doc.text(titleLines.slice(0, 2), margin, y);
    y += 13 * Math.min(titleLines.length, 2);
    doc.setFontSize(9);
    doc.text(
      [sample.creators.slice(0, 3).join(', '), sample.year !== null ? String(sample.year) : 'n.d.', sample.sourceLabel]
        .filter(Boolean)
        .join(' · '),
      margin,
      y,
    );
    y += 12;
    const verification =
      sample.verificationStatus === 'verified'
        ? `Link verified ${formatDate(sample.verificationCheckedAt)}`
        : sample.verificationStatus === 'failed'
          ? `Link check failed ${formatDate(sample.verificationCheckedAt)}`
          : sample.verificationStatus === 'stale'
            ? `Link check stale ${formatDate(sample.verificationCheckedAt)}`
            : 'Link not verified yet';
    doc.text(`${verification} · ${sample.landingUrl}`.slice(0, 160), margin, y);
    y += 16;
    doc.setDrawColor(235, 235, 235);
    doc.line(margin, y - 6, pageWidth - margin, y - 6);
  }

  doc.save(`esut-accreditation-evidence-${new Date().toISOString().slice(0, 10)}.pdf`);
};

export default function AccreditationEvidence() {
  usePageTitle('Accreditation Evidence');
  const [tab, setTab] = useState<EvidenceTab>('overview');
  const [evidence, setEvidence] = useState<EvidenceResponseData | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponseData | null>(null);
  const [programmes, setProgrammes] = useState<ProgrammeWithStats[]>([]);
  const [databases, setDatabases] = useState<AccreditationDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResponseData | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponseData | null>(null);
  const [syncProgramme, setSyncProgramme] = useState('');
  const [verifyLimit, setVerifyLimit] = useState(25);

  const loadAll = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const [evidenceData, syncData, programmeData] = await Promise.all([
        fetchEvidence(headers),
        fetchAccreditationSyncStatus(headers),
        fetchProgrammes(),
      ]);
      setEvidence(evidenceData);
      setSyncStatus(syncData);
      setProgrammes(programmeData.programmes);
      setDatabases(programmeData.databases);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load evidence data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const headers = await authHeaders();
        const [evidenceData, syncData, programmeData] = await Promise.all([
          fetchEvidence(headers),
          fetchAccreditationSyncStatus(headers),
          fetchProgrammes(),
        ]);
        if (cancelled) return;
        setEvidence(evidenceData);
        setSyncStatus(syncData);
        setProgrammes(programmeData.programmes);
        setDatabases(programmeData.databases);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load evidence data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSync = async (): Promise<void> => {
    if (
      !window.confirm(
        'Run a live synchronisation now? This makes a bounded number of network requests to the external open providers using the configured API keys, then updates the indexed records in place.',
      )
    ) {
      return;
    }
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const headers = await authHeaders();
      const result = await triggerAccreditationSync(
        syncProgramme ? { programme: syncProgramme } : {},
        headers,
      );
      setSyncResult(result);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Synchronisation failed.');
    } finally {
      setSyncing(false);
    }
  };

  const runVerify = async (): Promise<void> => {
    if (
      !window.confirm(
        `Check up to ${verifyLimit} stored links now? Each link receives at most one HTTP request with an 8 second timeout.`,
      )
    ) {
      return;
    }
    setVerifying(true);
    setError(null);
    setVerifyResult(null);
    try {
      const headers = await authHeaders();
      const result = await triggerAccreditationVerify({ limit: verifyLimit }, headers);
      setVerifyResult(result);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Link verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const subjectTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const programme of programmes) {
      totals.set(programme.slug, countSubjects(programme.subjects));
    }
    return totals;
  }, [programmes]);

  const databaseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const programme of programmes) {
      counts.set(
        programme.slug,
        databases.filter(
          (db) => db.programmeSlugs === 'all' || db.programmeSlugs.includes(programme.slug),
        ).length,
      );
    }
    return counts;
  }, [programmes, databases]);

  const latestSuccessfulSync = useMemo(() => {
    if (!evidence) return null;
    return evidence.syncState
      .filter((entry) => entry.last_status === 'ok' && entry.last_run_at)
      .map((entry) => entry.last_run_at as string)
      .sort()
      .pop() ?? null;
  }, [evidence]);

  if (loading && !evidence) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <p className="text-sm text-neutral-500">Loading accreditation evidence…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#D4A017' }}>
          Administrator · Restricted
        </p>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Accreditation Evidence Dashboard</h1>
        <p className="text-neutral-500 max-w-3xl">
          Measured counts from the actual indexed records for the 2026 NUC accreditation visit.
          Nothing on this page is estimated. Programme and subject minimums are internal screening
          heuristics, not NUC quotas.
        </p>
        {evidence ? (
          <p className="text-xs text-neutral-400 mt-2">
            Generated {evidence.generatedAt} · Most recent successful synchronisation:{' '}
            {formatDate(latestSuccessfulSync)}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-700 bg-white disabled:opacity-50"
        >
          Refresh evidence
        </button>
        <div className="flex items-center gap-2">
          <select
            value={syncProgramme}
            onChange={(event) => setSyncProgramme(event.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-2.5 text-sm bg-white"
            aria-label="Programme to synchronise"
          >
            <option value="">All 15 programmes</option>
            {programmes.map((programme) => (
              <option key={programme.slug} value={programme.slug}>
                {programme.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void runSync()}
            disabled={syncing || loading}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#1F3A5F' }}
          >
            {syncing ? 'Syncing…' : 'Run sync'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={verifyLimit}
            onChange={(event) => setVerifyLimit(Number(event.target.value))}
            className="border border-neutral-300 rounded-lg px-3 py-2.5 text-sm bg-white"
            aria-label="Links to verify"
          >
            {[10, 25, 50, 100].map((limit) => (
              <option key={limit} value={limit}>
                Check {limit} links
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void runVerify()}
            disabled={verifying || loading}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#1F3A5F' }}
          >
            {verifying ? 'Checking…' : 'Verify links'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => evidence && downloadCsv(evidence)}
          disabled={!evidence}
          className="px-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-700 bg-white disabled:opacity-50"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => evidence && downloadPdf(evidence, subjectTotals)}
          disabled={!evidence}
          className="px-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-700 bg-white disabled:opacity-50"
        >
          Export PDF
        </button>
      </div>

      {syncResult ? (
        <div className="border border-neutral-200 bg-white rounded-lg px-4 py-3 text-sm mb-6">
          <p className="font-semibold text-neutral-900 mb-1">
            Sync finished — {syncResult.requestsMade} request{syncResult.requestsMade === 1 ? '' : 's'} in{' '}
            {Math.round(syncResult.elapsedMs / 1000)}s
          </p>
          <ul className="space-y-0.5 text-neutral-600">
            {syncResult.runs.map((run) => (
              <li key={`${run.provider}::${run.programmeSlug}`}>
                {run.provider} / {run.programmeSlug}: fetched {run.fetched}, upserted {run.upserted} —{' '}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusTone(run.status)}`}>
                  {run.status}
                </span>
                {run.error ? ` — ${run.error}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {verifyResult ? (
        <div className="border border-neutral-200 bg-white rounded-lg px-4 py-3 text-sm mb-6">
          <p className="font-semibold text-neutral-900">
            Link check finished — {verifyResult.checked} checked, {verifyResult.verified} verified,{' '}
            {verifyResult.failed} failed, {verifyResult.unverifiable} unverifiable
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Evidence sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              tab === entry.id
                ? 'text-white border-transparent'
                : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
            }`}
            style={tab === entry.id ? { backgroundColor: '#1F3A5F', borderColor: '#1F3A5F' } : undefined}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {evidence ? (
        <>
          {tab === 'overview' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(evidence.totals).map(([metric, value]) => (
                  <div key={metric} className="border border-neutral-200 rounded-xl p-4 bg-white">
                    <p className="text-xs text-neutral-500 leading-tight">{TOTAL_LABELS[metric] ?? metric}</p>
                    <p className="text-2xl font-bold text-neutral-900 mt-1">{value}</p>
                  </div>
                ))}
              </div>
              <div className="border border-neutral-200 rounded-xl bg-white p-4 text-sm text-neutral-600 space-y-2">
                <p>
                  <strong className="text-neutral-900">Evidence status rules.</strong> Verified: every
                  checked link for the programme responded and no subject area is below the internal
                  minimum. Partially verified: links are verified but some subjects are weak or some
                  links failed. Pending review: no verified links yet. Not available: no records
                  indexed yet.
                </p>
                <p>
                  <strong className="text-neutral-900">Source-reported vs indexed.</strong> The current
                  integrations do not capture each provider&apos;s self-reported collection size, so
                  every figure on this page is an actual ESUT-indexed record count after
                  de-duplication.
                </p>
                <p>
                  <strong className="text-neutral-900">Verification.</strong> Failed links keep their
                  stored URL for traceability and their access label is downgraded. Unverifiable
                  answers (timeouts, 403/429/5xx) never claim a link is dead — previously verified
                  links are marked stale instead.
                </p>
              </div>
            </div>
          ) : null}

          {tab === 'programmes' ? (
            <div>
            <p className="text-sm text-neutral-500 mb-3">
              Per-programme counts cover external harvested records. Local catalogue and repository
              matches are reported separately on the Overview tab.
            </p>
            <div className="border border-neutral-200 rounded-xl bg-white overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="bg-neutral-50 text-left text-neutral-500">
                    <th scope="col" className="px-4 py-3 font-semibold">Programme</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Visit</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Indexed</th>
                    <th scope="col" className="px-3 py-3 font-semibold">2023+</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Ebooks</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Ebooks verified</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Articles</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Articles verified</th>
                    <th scope="col" className="px-3 py-3 font-semibold">OA journals</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Databases</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Subjects covered</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Weak subjects</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Failed links</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.byProgramme.map((entry) => (
                    <tr key={entry.slug} className="border-t border-neutral-100 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-neutral-900">{entry.name}</p>
                        {entry.warning ? (
                          <p className="text-xs text-amber-700 mt-0.5 max-w-[240px]">{entry.warning}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-neutral-500 whitespace-nowrap">
                        {formatDate(entry.visitStart)} – {formatDate(entry.visitEnd)}
                      </td>
                      <td className="px-3 py-3 text-neutral-700">{entry.total}</td>
                      <td className="px-3 py-3 text-neutral-700">{entry.recent2023}</td>
                      <td className="px-3 py-3 text-neutral-700">{entry.byType['ebook'] ?? 0}</td>
                      <td className="px-3 py-3 text-neutral-700">{entry.byTypeVerified['ebook'] ?? 0}</td>
                      <td className="px-3 py-3 text-neutral-700">{entry.byType['research_article'] ?? 0}</td>
                      <td className="px-3 py-3 text-neutral-700">
                        {entry.byTypeVerified['research_article'] ?? 0}
                      </td>
                      <td className="px-3 py-3 text-neutral-700">{entry.openAccessJournals}</td>
                      <td className="px-3 py-3 text-neutral-700">{databaseCounts.get(entry.slug) ?? 0}</td>
                      <td className="px-3 py-3 text-neutral-700">
                        {(subjectTotals.get(entry.slug) ?? 0) - entry.weakTopics.length}/
                        {subjectTotals.get(entry.slug) ?? 0}
                      </td>
                      <td className="px-3 py-3">
                        {entry.weakTopics.length > 0 ? (
                          <span
                            className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                            title={entry.weakTopics.join(', ')}
                          >
                            {entry.weakTopics.length}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-neutral-700">{entry.failedLinks}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${evidenceTone(entry.evidenceStatus)}`}
                        >
                          {EVIDENCE_STATUS_LABELS[entry.evidenceStatus]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          ) : null}

          {tab === 'sources' ? (
            <div className="space-y-6">
              <div className="border border-neutral-200 rounded-xl bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-neutral-500">
                      <th scope="col" className="px-4 py-3 font-semibold">Source</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Provider id</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Indexed</th>
                      <th scope="col" className="px-4 py-3 font-semibold">2023+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.byProvider.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-neutral-500">
                          No external records indexed yet. Run a sync to harvest the first batch.
                        </td>
                      </tr>
                    ) : (
                      evidence.byProvider.map((provider) => (
                        <tr key={provider.provider} className="border-t border-neutral-100">
                          <td className="px-4 py-3 font-medium text-neutral-900">{provider.label}</td>
                          <td className="px-4 py-3 text-neutral-500">{provider.provider}</td>
                          <td className="px-4 py-3 text-neutral-700">{provider.count}</td>
                          <td className="px-4 py-3 text-neutral-700">{provider.recent2023}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border border-neutral-200 rounded-xl bg-white p-4">
                <h2 className="font-bold text-neutral-900 mb-2">Configured providers</h2>
                <div className="flex flex-wrap gap-2">
                  {syncStatus?.providers.map((provider) => (
                    <span
                      key={provider.id}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                        provider.enabled
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                      }`}
                      title={provider.id}
                    >
                      {provider.displayName}
                      {provider.enabled ? '' : ' · disabled'}
                    </span>
                  )) ?? <p className="text-sm text-neutral-500">Provider list unavailable.</p>}
                </div>
              </div>

              <div className="border border-neutral-200 rounded-xl bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-neutral-500">
                      <th scope="col" className="px-4 py-3 font-semibold">Provider</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Programme</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Last run</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Fetched</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Upserted</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Last error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncStatus && syncStatus.state.length > 0 ? (
                      syncStatus.state.map((entry) => (
                        <tr key={`${entry.provider}::${entry.programme_slug}`} className="border-t border-neutral-100">
                          <td className="px-4 py-3 font-medium text-neutral-900">{entry.provider}</td>
                          <td className="px-4 py-3 text-neutral-600">{entry.programme_slug}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusTone(entry.last_status)}`}>
                              {entry.last_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                            {entry.last_run_at ? formatDate(entry.last_run_at) : 'Never'}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">{entry.records_fetched}</td>
                          <td className="px-4 py-3 text-neutral-700">{entry.records_upserted}</td>
                          <td className="px-4 py-3 text-xs text-red-600 max-w-[280px]">{entry.last_error ?? ''}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-neutral-500">
                          No synchronisation has run yet. Checkpoints appear after the first sync.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'samples' ? (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500">
                The ten most recent active records, each traceable to its source. These citations are
                included in the CSV and PDF exports.
              </p>
              {evidence.sampleRecords.length === 0 ? (
                <p className="text-sm text-neutral-500 border border-neutral-200 rounded-lg px-4 py-6 bg-white">
                  No records indexed yet.
                </p>
              ) : (
                evidence.sampleRecords.map((sample, index) => (
                  <div key={`${sample.landingUrl}::${index}`} className="border border-neutral-200 rounded-xl bg-white p-4">
                    <a
                      href={sample.landingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-neutral-900 hover:underline"
                    >
                      {sample.title}
                    </a>
                    <p className="text-sm text-neutral-600 mt-1">
                      {[sample.creators.slice(0, 3).join(', '), sample.year !== null ? String(sample.year) : null, sample.sourceLabel]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {sample.doi ? `DOI ${sample.doi} · ` : ''}
                      {sample.verificationStatus === 'verified'
                        ? `Link verified ${formatDate(sample.verificationCheckedAt)}`
                        : sample.verificationStatus === 'failed'
                          ? `Link check failed ${formatDate(sample.verificationCheckedAt)}`
                          : sample.verificationStatus === 'stale'
                            ? `Link check stale ${formatDate(sample.verificationCheckedAt)}`
                            : 'Link not verified yet'}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-neutral-500">Evidence data unavailable.</p>
      )}
    </div>
  );
}
