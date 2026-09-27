export interface MarcField {
  tag: string;
  ind1: string;
  ind2: string;
  subfields: { code: string; value: string }[];
}

export interface MarcRecord {
  leader: string;
  fields: MarcField[];
}

export function emptyMarcRecord(): MarcRecord {
  return { leader: '00000nam a2200000 a 4500', fields: [] };
}

export function marcToJsonb(record: MarcRecord): Record<string, unknown> {
  return { leader: record.leader, fields: record.fields };
}

export function jsonbToMarc(jsonb: Record<string, unknown>): MarcRecord {
  const leader = typeof jsonb.leader === 'string' ? jsonb.leader : '00000nam a2200000 a 4500';
  const fields = Array.isArray(jsonb.fields) ? (jsonb.fields as MarcField[]) : [];
  return { leader, fields };
}

export function marcToXml(record: MarcRecord): string {
  const fieldsXml = record.fields.map((f) => {
    const subfields = f.subfields
      .map((sf) => `      <subfield code="${sf.code}">${escapeXml(sf.value)}</subfield>`)
      .join('\n');
    return `    <datafield tag="${f.tag}" ind1="${f.ind1}" ind2="${f.ind2}">\n${subfields}\n    </datafield>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<record xmlns="http://www.loc.gov/MARC21/slim">
  <leader>${escapeXml(record.leader)}</leader>
${fieldsXml}
</record>`;
}

export function marcToJson(record: MarcRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of record.fields) {
    if (field.tag.startsWith('00')) {
      const value = field.subfields.map((sf) => sf.value).join('');
      result[field.tag] = value;
    } else {
      const fieldObj: Record<string, unknown> = { ind1: field.ind1, ind2: field.ind2 };
      for (const sf of field.subfields) {
        fieldObj[sf.code] = sf.value;
      }
      if (!result[field.tag]) result[field.tag] = [];
      (result[field.tag] as unknown[]).push(fieldObj);
    }
  }
  return result;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createField(tag: string, ind1: string, ind2: string, subfields: { code: string; value: string }[]): MarcField {
  return { tag, ind1, ind2, subfields };
}

export function addSubfield(field: MarcField, code: string, value: string): MarcField {
  return { ...field, subfields: [...field.subfields, { code, value }] };
}
