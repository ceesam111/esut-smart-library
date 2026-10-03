import { xmlEscape } from '@/server/oai/oaiXml';

export interface SRURecord {
  id: string;
  title: string;
  authors: string[];
  isbn?: string;
  issn?: string;
  publisher?: string;
  year?: number;
  format?: string;
  abstract?: string;
  subjects?: string[];
  callNumber?: string;
  language?: string;
  doi?: string;
  placeOfPublication?: string;
  physicalDescription?: string;
  series?: string;
  edition?: string;
}

export function toDublinCore(record: SRURecord): string {
  const creators = record.authors.map((a) => `    <creator>${xmlEscape(a)}</creator>`).join('\n');
  const subjects = (record.subjects ?? []).map((s) => `    <subject>${xmlEscape(s)}</subject>`).join('\n');
  return `  <dc xmlns="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <title>${xmlEscape(record.title)}</title>
${creators}
${subjects}
    <identifier>${xmlEscape(record.id)}</identifier>
${record.isbn ? `    <identifier>ISBN:${xmlEscape(record.isbn)}</identifier>` : ''}
${record.issn ? `    <identifier>ISSN:${xmlEscape(record.issn)}</identifier>` : ''}
${record.doi ? `    <identifier>DOI:${xmlEscape(record.doi)}</identifier>` : ''}
    <type>${xmlEscape(record.format ?? 'text')}</type>
${record.year ? `    <date>${xmlEscape(String(record.year))}</date>` : ''}
${record.publisher ? `    <publisher>${xmlEscape(record.publisher)}</publisher>` : ''}
${record.language ? `    <language>${xmlEscape(record.language)}</language>` : ''}
${record.abstract ? `    <description>${xmlEscape(record.abstract)}</description>` : ''}
  </dc>`;
}

export function toMARCXML(record: SRURecord): string {
  const control001 = record.id;
  const control003 = 'ESUT';
  const control005 = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) + '.0';
  const leader = '00000nam a2200000 a 4500';

  const datafields: string[] = [];

  if (record.isbn) {
    datafields.push(`  <datafield tag="020" ind1=" " ind2=" ">
    <subfield code="a">${xmlEscape(record.isbn)}</subfield>
  </datafield>`);
  }

  if (record.issn) {
    datafields.push(`  <datafield tag="022" ind1=" " ind2=" ">
    <subfield code="a">${xmlEscape(record.issn)}</subfield>
  </datafield>`);
  }

  datafields.push(`  <datafield tag="040" ind1=" " ind2=" ">
    <subfield code="a">ESUT</subfield>
    <subfield code="b">eng</subfield>
  </datafield>`);

  if (record.authors.length > 0) {
    datafields.push(`  <datafield tag="100" ind1="1" ind2=" ">
    <subfield code="a">${xmlEscape(record.authors[0])}</subfield>
  </datafield>`);
  }

  datafields.push(`  <datafield tag="245" ind1="1" ind2="0">
    <subfield code="a">${xmlEscape(record.title)}</subfield>
  </datafield>`);

  if (record.publisher || record.year || record.placeOfPublication) {
    const subfields: string[] = [];
    if (record.placeOfPublication) subfields.push(`    <subfield code="a">${xmlEscape(record.placeOfPublication)}</subfield>`);
    if (record.publisher) subfields.push(`    <subfield code="b">${xmlEscape(record.publisher)}</subfield>`);
    if (record.year) subfields.push(`    <subfield code="c">${xmlEscape(String(record.year))}</subfield>`);
    datafields.push(`  <datafield tag="260" ind1=" " ind2=" ">
${subfields.join('\n')}
  </datafield>`);
  }

  if (record.physicalDescription) {
    datafields.push(`  <datafield tag="300" ind1=" " ind2=" ">
    <subfield code="a">${xmlEscape(record.physicalDescription)}</subfield>
  </datafield>`);
  }

  if (record.series) {
    datafields.push(`  <datafield tag="490" ind1="0" ind2=" ">
    <subfield code="a">${xmlEscape(record.series)}</subfield>
  </datafield>`);
  }

  for (const subject of record.subjects ?? []) {
    datafields.push(`  <datafield tag="650" ind1=" " ind2="0">
    <subfield code="a">${xmlEscape(subject)}</subfield>
  </datafield>`);
  }

  if (record.abstract) {
    datafields.push(`  <datafield tag="520" ind1=" " ind2=" ">
    <subfield code="a">${xmlEscape(record.abstract)}</subfield>
  </datafield>`);
  }

  return `  <record xmlns="http://www.loc.gov/MARC21/slim">
    <leader>${leader}</leader>
    <controlfield tag="001">${xmlEscape(control001)}</controlfield>
    <controlfield tag="003">${xmlEscape(control003)}</controlfield>
    <controlfield tag="005">${xmlEscape(control005)}</controlfield>
${datafields.join('\n')}
  </record>`;
}

export function serializeRecord(record: SRURecord, schema: string): string {
  if (schema === 'info:srw/schema/1/marcxml') {
    return toMARCXML(record);
  }
  return toDublinCore(record);
}
