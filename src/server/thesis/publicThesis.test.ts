import { describe, expect, it } from 'vitest';
import {
  coerceCoSupervisors,
  degreeFilterConditions,
  isPubliclyVisibleThesis,
  isThesisFileEmbargoed,
  thesisEmbargoUntil,
  toScholarlyThesis,
  type PublicThesis,
} from './publicThesis';
import { buildScholarlyJsonLd, buildScholarlyMetadata } from '@/server/seo/scholarlyMetadata';

const baseThesis: PublicThesis = {
  id: 'a9e8d7c6-0000-4000-8000-000000000001',
  title: 'Solar Photovoltaic Adoption in Enugu State',
  abstract: 'An empirical study of household adoption drivers.',
  keywords: ['solar', 'adoption'],
  degree: 'Ph.D.',
  department: 'Physics',
  faculty: 'Science',
  programme: 'Physics',
  supervisor: 'Prof. N. Okafor',
  co_supervisors: [{ name: 'Dr. A. Bello' }],
  submission_type: 'thesis',
  language: 'English',
  year: 2026,
  pages: 142,
  session: '2025/2026',
  reference_no: 'ESUT/TH/2026/0042',
  doi: null,
  status: 'published',
  student_name: 'Okoro, Chidi J.',
  repository_item_id: null,
  created_at: '2026-05-01T09:00:00.000Z',
  updated_at: '2026-06-01T09:00:00.000Z',
  embargo_until: null,
  has_file: true,
  file_available: true,
};

describe('thesisEmbargoUntil', () => {
  it('returns null when embargo is disabled', () => {
    expect(
      thesisEmbargoUntil({
        embargo_enabled: false,
        embargo_period_months: 12,
        approval_date: '2026-06-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('returns null when months are zero or missing', () => {
    expect(
      thesisEmbargoUntil({
        embargo_enabled: true,
        embargo_period_months: 0,
        approval_date: null,
        created_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toBeNull();
    expect(
      thesisEmbargoUntil({
        embargo_enabled: true,
        embargo_period_months: null,
        approval_date: null,
        created_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('adds months to the approval date when present', () => {
    const until = thesisEmbargoUntil({
      embargo_enabled: true,
      embargo_period_months: 6,
      approval_date: '2026-06-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(until).toBe('2026-12-01T00:00:00.000Z');
  });

  it('falls back to the creation date before approval', () => {
    const until = thesisEmbargoUntil({
      embargo_enabled: true,
      embargo_period_months: 3,
      approval_date: null,
      created_at: '2026-01-15T00:00:00.000Z',
    });
    expect(until).toBe('2026-04-15T00:00:00.000Z');
  });
});

describe('isThesisFileEmbargoed', () => {
  const future = {
    embargo_enabled: true,
    embargo_period_months: 12,
    approval_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('treats an active embargo as blocking', () => {
    expect(isThesisFileEmbargoed(future)).toBe(true);
  });

  it('treats a lapsed embargo as open', () => {
    expect(
      isThesisFileEmbargoed({
        embargo_enabled: true,
        embargo_period_months: 12,
        approval_date: '2020-01-01T00:00:00.000Z',
        created_at: '2020-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('treats disabled embargoes as open', () => {
    expect(
      isThesisFileEmbargoed({
        embargo_enabled: false,
        embargo_period_months: 12,
        approval_date: null,
        created_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });
});

describe('isPubliclyVisibleThesis', () => {
  it('only exposes published theses', () => {
    expect(isPubliclyVisibleThesis({ status: 'published' })).toBe(true);
    expect(isPubliclyVisibleThesis({ status: 'approved' })).toBe(false);
    expect(isPubliclyVisibleThesis({ status: 'submitted' })).toBe(false);
    expect(isPubliclyVisibleThesis({ status: 'draft' })).toBe(false);
    expect(isPubliclyVisibleThesis({ status: 'withdrawn' })).toBe(false);
  });
});

describe('toScholarlyThesis', () => {
  const item = toScholarlyThesis(baseThesis);

  it('points the canonical landing path at the thesis route', () => {
    expect(item.landing_path).toBe(`/theses/${baseThesis.id}`);
    expect(buildScholarlyMetadata(item).alternates?.canonical).toContain(`/theses/${baseThesis.id}`);
  });

  it('uses the student as author and never the supervisor', () => {
    expect(item.authors).toEqual([baseThesis.student_name]);
    const jsonLd = buildScholarlyJsonLd(item);
    expect(jsonLd['@type']).toBe('Thesis');
    const authors = jsonLd.author as Array<{ name: string }>;
    expect(authors.map((author) => author.name)).toEqual(['Okoro, Chidi J.']);
    expect(JSON.stringify(jsonLd)).not.toContain('Prof. N. Okafor');
  });

  it('never exposes a full-text file url for a thesis record', () => {
    expect(item.file_url).toBeNull();
    const jsonLd = buildScholarlyJsonLd(item);
    expect(jsonLd.isAccessibleForFree).toBe(false);
    expect(jsonLd.encoding).toBeUndefined();
  });

  it('carries citation metadata through to the metadata object', () => {
    const metadata = buildScholarlyMetadata(item);
    expect(metadata.other?.citation_title).toBe(baseThesis.title);
    expect(metadata.other?.citation_author).toEqual([baseThesis.student_name]);
    expect(metadata.other?.citation_publication_date).toBe('2026');
    expect(metadata.other?.citation_pdf_url).toBeUndefined();
  });
});

describe('coerceCoSupervisors', () => {
  it('keeps only display names and drops emails and orcids', () => {
    const result = coerceCoSupervisors([
      { name: 'Dr. A. Bello', email: 'bello@example.com', orcid: '0000-0002-1825-0097' },
      'Dr. B. Okoro',
      { email: 'noname@example.com' },
    ]);
    expect(result).toEqual([{ name: 'Dr. A. Bello' }, { name: 'Dr. B. Okoro' }]);
  });
});

describe('degreeFilterConditions', () => {
  it('maps friendly labels to dot-insensitive degree patterns', () => {
    expect(degreeFilterConditions('PhD')).toContain('degree.ilike.%ph.d%');
    expect(degreeFilterConditions('Masters')?.length).toBeGreaterThan(1);
    expect(degreeFilterConditions('Undergraduate')).toContain('degree.ilike.%nce%');
  });

  it('ignores unknown and empty labels', () => {
    expect(degreeFilterConditions(undefined)).toBeNull();
    expect(degreeFilterConditions('All Levels')).toBeNull();
  });
});
