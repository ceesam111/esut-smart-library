export interface RorOrganization {
  id: string;
  name: string;
  types: string[];
  country: {
    country_name: string;
    country_code: string;
  };
  aliases: string[];
  acronyms: string[];
  external_ids: Record<string, unknown>;
  links: string[];
  locations: Array<{geonames_city: { id: number; city: string } | null}>;
}

export async function searchRor(query: string): Promise<RorOrganization[]> {
  try {
    const res = await fetch(`https://api.ror.org/organizations?query=${encodeURIComponent(query)}&limit=5`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item: Record<string, unknown>) => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      types: Array.isArray(item.types) ? item.types as string[] : [],
      country: {
        country_name: String((item.country as Record<string, unknown>)?.country_name || ''),
        country_code: String((item.country as Record<string, unknown>)?.country_code || ''),
      },
      aliases: Array.isArray(item.aliases) ? item.aliases as string[] : [],
      acronyms: Array.isArray(item.acronyms) ? item.acronyms as string[] : [],
      external_ids: (item.external_ids as Record<string, unknown>) || {},
      links: Array.isArray(item.links) ? item.links as string[] : [],
      locations: Array.isArray(item.locations) ? item.locations : [],
    }));
  } catch {
    return [];
  }
}

export async function getRorById(rorId: string): Promise<RorOrganization | null> {
  try {
    const res = await fetch(`https://api.ror.org/organizations/${encodeURIComponent(rorId)}`);
    if (!res.ok) return null;
    const item = await res.json();
    return {
      id: String(item.id || ''),
      name: String(item.name || ''),
      types: Array.isArray(item.types) ? item.types as string[] : [],
      country: {
        country_name: String((item.country as Record<string, unknown>)?.country_name || ''),
        country_code: String((item.country as Record<string, unknown>)?.country_code || ''),
      },
      aliases: Array.isArray(item.aliases) ? item.aliases as string[] : [],
      acronyms: Array.isArray(item.acronyms) ? item.acronyms as string[] : [],
      external_ids: (item.external_ids as Record<string, unknown>) || {},
      links: Array.isArray(item.links) ? item.links as string[] : [],
      locations: Array.isArray(item.locations) ? item.locations : [],
    };
  } catch {
    return null;
  }
}
