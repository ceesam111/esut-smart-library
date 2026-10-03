export interface MarcField {
  tag: string;
  ind1?: string;
  ind2?: string;
  value?: string;
  subfields?: Array<{ code: string; value: string }>;
}

export interface MarcRecord {
  leader: string;
  fields: MarcField[];
}

export function parseMarcXml(xml: string): MarcRecord {
  const leaderMatch = xml.match(/<leader>([^<]*)<\/leader>/);
  const leader = leaderMatch?.[1]?.trim() ?? '00000nam a2200000 i 4500';

  const fields: MarcField[] = [];

  const controlRegex = /<controlfield\s+tag="([^"]*)"[^>]*>([^<]*)<\/controlfield>/g;
  let match;
  while ((match = controlRegex.exec(xml)) !== null) {
    fields.push({ tag: match[1], value: unescapeXml(match[2]) });
  }

  const dataRegex = /<datafield\s+tag="([^"]*)"\s+ind1="([^"]*)"\s+ind2="([^"]*)"[^>]*>([\s\S]*?)<\/datafield>/g;
  while ((match = dataRegex.exec(xml)) !== null) {
    const tag = match[1];
    const ind1 = match[2];
    const ind2 = match[3];
    const content = match[4];

    const subfields: Array<{ code: string; value: string }> = [];
    const sfRegex = /<subfield\s+code="([^"]*)"[^>]*>([^<]*)<\/subfield>/g;
    let sfMatch;
    while ((sfMatch = sfRegex.exec(content)) !== null) {
      subfields.push({ code: sfMatch[1], value: unescapeXml(sfMatch[2]) });
    }

    fields.push({ tag, ind1, ind2, subfields });
  }

  return { leader, fields };
}

export function serializeMarcXml(record: MarcRecord): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<collection xmlns="http://www.loc.gov/MARC21/slim">', '<record>'];

  lines.push(`  <leader>${escapeXml(record.leader)}</leader>`);

  for (const field of record.fields) {
    if (field.value !== undefined) {
      lines.push(`  <controlfield tag="${field.tag}">${escapeXml(field.value)}</controlfield>`);
    } else {
      const ind1 = field.ind1 ?? ' ';
      const ind2 = field.ind2 ?? ' ';
      lines.push(`  <datafield tag="${field.tag}" ind1="${ind1}" ind2="${ind2}">`);
      for (const sf of field.subfields ?? []) {
        lines.push(`    <subfield code="${sf.code}">${escapeXml(sf.value)}</subfield>`);
      }
      lines.push('  </datafield>');
    }
  }

  lines.push('</record>', '</collection>');
  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unescapeXml(str: string): string {
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

export function recordToMarcJsonb(record: MarcRecord): { leader: string; fields: MarcField[] } {
  return { leader: record.leader, fields: record.fields };
}

export function marcjJsonbToRecord(jsonb: { leader: string; fields: MarcField[] }): MarcRecord {
  return { leader: jsonb.leader, fields: jsonb.fields };
}
