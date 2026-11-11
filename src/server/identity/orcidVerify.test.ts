import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyOrcidClaim } from './orcidVerify';

const VALID_ORCID = '0000-0002-1825-0097';

function recordJson(overrides: { given?: string; family?: string } = {}) {
  return {
    person: {
      name: {
        'given-names': { value: overrides.given ?? 'Josiah' },
        'family-name': { value: overrides.family ?? 'Carberry' },
      },
    },
    'activities-summary': {
      employments: {
        'affiliation-group': [
          { summaries: [{ 'employment-summary': { organization: { name: 'ESUT' } } }] },
          { summaries: [{ 'employment-summary': { organization: { name: '' } } }] },
        ],
      },
    },
  };
}

const fetchMock = vi.fn();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function stubFetch() {
  vi.stubGlobal('fetch', fetchMock);
}

describe('verifyOrcidClaim', () => {
  it('rejects a checksum-invalid ORCID without calling the registry', async () => {
    stubFetch();
    const result = await verifyOrcidClaim({ orcid: '0000-0002-1825-0094', profileName: 'Josiah Carberry' });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('invalid_format');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verifies when the registry record matches the profile name', async () => {
    stubFetch();
    fetchMock.mockResolvedValue({ ok: true, json: async () => recordJson() });
    const result = await verifyOrcidClaim({ orcid: VALID_ORCID, profileName: 'Josiah Carberry' });
    expect(result.ok).toBe(true);
    expect(result.orcid).toBe(VALID_ORCID);
    expect(result.nameMatch).toBe(true);
    expect(result.record?.fullName).toBe('Josiah Carberry');
    expect(result.record?.employments).toEqual(['ESUT']);
    expect(String(fetchMock.mock.calls[0][0])).toContain(VALID_ORCID);
  });

  it('returns name_mismatch with the registry name for librarian-visible diagnosis', async () => {
    stubFetch();
    fetchMock.mockResolvedValue({ ok: true, json: async () => recordJson() });
    const result = await verifyOrcidClaim({ orcid: VALID_ORCID, profileName: 'Jane Doe' });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('name_mismatch');
    expect(result.record?.fullName).toBe('Josiah Carberry');
    expect(result.nameMatch).toBe(false);
  });

  it('returns no_profile_name when the profile has no name yet', async () => {
    stubFetch();
    fetchMock.mockResolvedValue({ ok: true, json: async () => recordJson() });
    const result = await verifyOrcidClaim({ orcid: VALID_ORCID, profileName: '   ' });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('no_profile_name');
  });

  it('returns not_found for a valid but unregistered ORCID', async () => {
    stubFetch();
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    const result = await verifyOrcidClaim({ orcid: VALID_ORCID, profileName: 'Josiah Carberry' });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('not_found');
  });

  it('returns fetch_failed when the registry is unreachable', async () => {
    stubFetch();
    fetchMock.mockRejectedValue(new Error('network down'));
    const result = await verifyOrcidClaim({ orcid: VALID_ORCID, profileName: 'Josiah Carberry' });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe('fetch_failed');
    expect(result.record).toBeNull();
  });
});
