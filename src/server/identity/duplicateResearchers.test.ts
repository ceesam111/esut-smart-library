import { describe, expect, it } from 'vitest';
import {
  buildIdentityReport,
  findInvalidOrcids,
  groupDuplicateNames,
  groupDuplicateOrcids,
  researcherDisplayName,
  type ResearcherIdentityRow,
} from './duplicateResearchers';

function row(overrides: Partial<ResearcherIdentityRow> & { id: string }): ResearcherIdentityRow {
  return {
    patron_id: null,
    first_name: 'Chinedu',
    middle_name: null,
    surname: 'Okafor',
    department: null,
    institutional_email: null,
    orcid_id: null,
    orcid_verified: false,
    status: 'published',
    ...overrides,
  };
}

describe('researcherDisplayName', () => {
  it('joins available name parts', () => {
    expect(researcherDisplayName(row({ id: 'a' }))).toBe('Chinedu Okafor');
    expect(researcherDisplayName(row({ id: 'b', middle_name: 'Emeka' }))).toBe('Chinedu Emeka Okafor');
  });
});

describe('groupDuplicateOrcids', () => {
  it('groups profiles claiming the same formatted ORCID', () => {
    const groups = groupDuplicateOrcids([
      row({ id: 'a', orcid_id: '0000-0002-1825-0097' }),
      row({ id: 'b', first_name: 'Other', surname: 'Person', orcid_id: '0000-0002-1825-0097' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('orcid');
    expect(groups[0].members.map((member) => member.id)).toEqual(['a', 'b']);
  });

  it('groups URL-form and dashed-form claims as the same ORCID', () => {
    const groups = groupDuplicateOrcids([
      row({ id: 'a', orcid_id: '0000-0002-1825-0097' }),
      row({ id: 'b', orcid_id: 'https://orcid.org/0000-0002-1825-0097' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('0000-0002-1825-0097');
  });

  it('reports no groups for distinct or missing ORCIDs', () => {
    expect(groupDuplicateOrcids([
      row({ id: 'a', orcid_id: '0000-0002-1825-0097' }),
      row({ id: 'b', orcid_id: '0000-0000-0000-001X' }),
      row({ id: 'c', orcid_id: null }),
    ])).toEqual([]);
  });
});

describe('groupDuplicateNames', () => {
  it('groups name-order variants of the same researcher identity', () => {
    const groups = groupDuplicateNames([
      row({ id: 'a' }),
      row({ id: 'b', first_name: 'Okafor', surname: 'Chinedu' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('name');
    expect(groups[0].members).toHaveLength(2);
  });

  it('does not group different researchers', () => {
    expect(groupDuplicateNames([
      row({ id: 'a' }),
      row({ id: 'b', first_name: 'Chidi', surname: 'Eze' }),
    ])).toEqual([]);
  });
});

describe('findInvalidOrcids', () => {
  it('lists stored ORCIDs that fail checksum validation', () => {
    const invalid = findInvalidOrcids([
      row({ id: 'a', orcid_id: '0000-0002-1825-0094' }),
      row({ id: 'b', first_name: 'Valid', orcid_id: '0000-0002-1825-0097' }),
      row({ id: 'c', first_name: 'Empty', orcid_id: null }),
      row({ id: 'd', first_name: 'Garbage', orcid_id: 'not-an-orcid' }),
    ]);
    expect(invalid.map((entry) => entry.id)).toEqual(['a', 'd']);
  });
});

describe('buildIdentityReport', () => {
  it('scans every row and reports each section with a timestamp', () => {
    const report = buildIdentityReport([
      row({ id: 'a', orcid_id: '0000-0002-1825-0094' }),
      row({ id: 'b', first_name: 'Other', orcid_id: '0000-0002-1825-0094' }),
      row({ id: 'c', first_name: 'Solo', surname: 'Man' }),
    ]);
    expect(report.scanned).toBe(3);
    expect(report.orcidDuplicates).toHaveLength(1);
    expect(report.nameDuplicates).toHaveLength(0);
    expect(report.invalidOrcids.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false);
  });
});
