import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export function itemToMARCXML(item: Record<string, unknown>): string {
  const leader = '00000nam a2200000 a 4500';
  const controlFields = [
    `<controlfield tag="001">${String(item.id || '').replace(/[^a-zA-Z0-9-]/g, '')}</controlfield>`,
    `<controlfield tag="003">ESUT</controlfield>`,
    `<controlfield tag="005">${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}</controlfield>`,
  ];

  const dataFields: string[] = [];
  const title = String(item.title || '').slice(0, 200);
  dataFields.push(`<datafield tag="245" ind1="1" ind2="0"><subfield code="a">${escapeXml(title)}</subfield></datafield>`);

  const authors = Array.isArray(item.authors) ? item.authors : [];
  authors.forEach((author, i) => {
    dataFields.push(`<datafield tag="100" ind1="1" ind2=""><subfield code="a">${escapeXml(String(author))}</subfield></datafield>`);
  });

  if (item.abstract) {
    dataFields.push(`<datafield tag="520" ind1=" " ind2=" "><subfield code="a">${escapeXml(String(item.abstract).slice(0, 500))}</subfield></datafield>`);
  }

  if (item.year) {
    dataFields.push(`<datafield tag="260" ind1=" " ind2=" "><subfield code="c">${escapeXml(String(item.year))}</subfield></datafield>`);
  }

  if (item.doi) {
    dataFields.push(`<datafield tag="024" ind1="7" ind2=" "><subfield code="a">${escapeXml(String(item.doi))}</subfield><subfield code="2">doi</subfield></datafield>`);
  }

  const fields = [...controlFields, ...dataFields].join('');
  return `<?xml version="1.0" encoding="UTF-8"?><collection xmlns="http://www.loc.gov/MARC21/slim"><record><leader>${leader}</leader>${fields}</record></collection>`;
}

export function parseMARCXML(xml: string): Record<string, unknown> | null {
  const idMatch = xml.match(/<controlfield tag="001">([^<]+)<\/controlfield>/);
  const titleMatch = xml.match(/<datafield tag="245"[^>]*>[\s\S]*?<subfield code="a">([^<]+)<\/subfield>/);
  const authorMatches = [...xml.matchAll(/<datafield tag="100"[^>]*>[\s\S]*?<subfield code="a">([^<]+)<\/subfield>/g)];
  const abstractMatch = xml.match(/<datafield tag="520"[^>]*>[\s\S]*?<subfield code="a">([^<]+)<\/subfield>/);
  const yearMatch = xml.match(/<datafield tag="260"[^>]*>[\s\S]*?<subfield code="c">(\d{4})<\/subfield>/);
  const doiMatch = xml.match(/<datafield tag="024"[^>]*>[\s\S]*?<subfield code="a">([^<]+)<\/subfield>/);

  if (!titleMatch) return null;

  return {
    id: idMatch?.[1] || crypto.randomUUID(),
    title: titleMatch[1],
    authors: authorMatches.map((m) => m[1]),
    abstract: abstractMatch?.[1] || null,
    year: yearMatch?.[1] ? Number(yearMatch[1]) : null,
    doi: doiMatch?.[1] || null,
  };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function validateMARCXML(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!xml.includes('<collection')) errors.push('Missing collection element');
  if (!xml.includes('<record>')) errors.push('Missing record element');
  if (!xml.includes('<leader>')) errors.push('Missing leader');
  if (!xml.includes('tag="245"')) errors.push('Missing title field (245)');
  return { valid: errors.length === 0, errors };
}
