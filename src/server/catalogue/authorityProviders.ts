export interface NormalizedAuthorityResult {
  preferredHeading: string;
  variants: string[];
  authorityType: string;
  externalId: string;
  provider: string;
  sourceUri: string | null;
  identifiers: Record<string, string>;
}

export interface AuthorityProvider {
  name: string;
  search(query: string, type?: string): Promise<NormalizedAuthorityResult[]>;
}

class VIAFProvider implements AuthorityProvider {
  name = 'VIAF';
  async search(query: string): Promise<NormalizedAuthorityResult[]> {
    try {
      const url = `https://viaf.org/viaf/search?query=local.personalNames+all+%22${encodeURIComponent(query)}%22&sortKeys=holdingscount&recordSchema=BriefVIAF`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];
      const text = await res.text();
      const results: NormalizedAuthorityResult[] = [];
      const matches = text.matchAll(/<a[^>]*href="\/viaf\/(\d+)"[^>]*>([^<]+)<\/a>/g);
      for (const m of matches) {
        results.push({
          preferredHeading: m[2],
          variants: [],
          authorityType: 'PERSON',
          externalId: m[1],
          provider: 'VIAF',
          sourceUri: `https://viaf.org/viaf/${m[1]}`,
          identifiers: { VIAF: m[1] },
        });
        if (results.length >= 5) break;
      }
      return results;
    } catch {
      return [];
    }
  }
}

class LCProvider implements AuthorityProvider {
  name = 'Library of Congress';
  async search(query: string): Promise<NormalizedAuthorityResult[]> {
    try {
      const url = `https://id.loc.gov/search/?q=${encodeURIComponent(query)}&format=json&q=cs:http://id.loc.gov/authorities/names`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];
      const data = await res.json();
      const results: NormalizedAuthorityResult[] = [];
      for (const item of data.slice(0, 5)) {
        const uri = item['@id'] ?? '';
        const id = uri.split('/').pop() ?? '';
        results.push({
          preferredHeading: item.title ?? query,
          variants: [],
          authorityType: 'PERSON',
          externalId: id,
          provider: 'LC',
          sourceUri: uri,
          identifiers: { LCNAF: id },
        });
      }
      return results;
    } catch {
      return [];
    }
  }
}

class ORCIDProvider implements AuthorityProvider {
  name = 'ORCID';
  async search(query: string): Promise<NormalizedAuthorityResult[]> {
    try {
      const url = `https://pub.orcid.org/v3.0/search/?q=${encodeURIComponent(query)}&rows=5`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const results: NormalizedAuthorityResult[] = [];
      for (const item of data['search-result'] ?? []) {
        const profile = item['orcid-identifier'];
        if (!profile) continue;
        results.push({
          preferredHeading: query,
          variants: [],
          authorityType: 'PERSON',
          externalId: profile.path,
          provider: 'ORCID',
          sourceUri: `https://orcid.org/${profile.path}`,
          identifiers: { ORCID: profile.path },
        });
      }
      return results;
    } catch {
      return [];
    }
  }
}

class RORProvider implements AuthorityProvider {
  name = 'ROR';
  async search(query: string): Promise<NormalizedAuthorityResult[]> {
    try {
      const url = `https://api.ror.org/organizations?query=${encodeURIComponent(query)}&page=1&size=5`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];
      const data = await res.json();
      const results: NormalizedAuthorityResult[] = [];
      for (const item of data.items ?? []) {
        results.push({
          preferredHeading: item.name ?? query,
          variants: [],
          authorityType: 'CORPORATE_BODY',
          externalId: item.id ?? '',
          provider: 'ROR',
          sourceUri: item.id ?? null,
          identifiers: { ROR: item.id ?? '' },
        });
      }
      return results;
    } catch {
      return [];
    }
  }
}

const providers: AuthorityProvider[] = [
  new VIAFProvider(),
  new LCProvider(),
  new ORCIDProvider(),
  new RORProvider(),
];

export async function searchAuthorityProviders(query: string, type?: string): Promise<Array<NormalizedAuthorityResult & { provider: string }>> {
  const results: Array<NormalizedAuthorityResult & { provider: string }> = [];
  const errors: string[] = [];

  await Promise.all(providers.map(async (provider) => {
    try {
      const providerResults = await provider.search(query, type);
      results.push(...providerResults);
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }));

  return results;
}

export function getProviderNames(): string[] {
  return providers.map(p => p.name);
}
