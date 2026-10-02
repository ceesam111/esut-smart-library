import { xmlEscape } from './oaiXml';

export type MetadataPrefix = 'oai_dc' | 'datacite' | 'marcxml';

export const SUPPORTED_METADATA_PREFIXES: readonly MetadataPrefix[] = ['oai_dc', 'datacite', 'marcxml'];

export const METADATA_FORMATS: Record<MetadataPrefix, { schema: string; namespace: string }> = {
  oai_dc: {
    schema: 'http://www.openarchives.org/OAI/2.0/oai_dc.xsd',
    namespace: 'http://www.openarchives.org/OAI/2.0/oai_dc/',
  },
  datacite: {
    schema: 'https://schema.datacite.org/meta/kernel-4.4/metadata.xsd',
    namespace: 'http://datacite.org/schema/kernel-4.4',
  },
  marcxml: {
    schema: 'http://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd',
    namespace: 'http://www.loc.gov/MARC21/slim',
  },
};

export function isMetadataPrefix(value: string | null | undefined): value is MetadataPrefix {
  return SUPPORTED_METADATA_PREFIXES.includes(value as MetadataPrefix);
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === 'string' ? entry : String((entry as { name?: string })?.name ?? ''))).filter(Boolean);
}

function itemUrl(item: { id?: string; handle?: string | null }, baseUrl: string): string {
  const slug = encodeURIComponent(String(item.handle ?? item.id ?? ''));
  const origin = baseUrl.replace(/\/api\/oai\/?$/, '').replace(/\/api\/oai$/, '');
  return `${origin}/repository/${slug}`;
}

export function toDublinCore(item: Record<string, unknown>, baseUrl: string): string {
  const authors = asArray(item.authors);
  const subjects = [...asArray(item.subjects), ...asArray(item.keywords)];
  const doi = (item.doi as string) ?? null;
  const url = itemUrl(item, baseUrl);

  const creatorTags = authors.map((author) => `        <dc:creator>${xmlEscape(author)}</dc:creator>`).join('\n');
  const subjectTags = subjects.map((subject) => `        <dc:subject>${xmlEscape(subject)}</dc:subject>`).join('\n');
  const identifierTags = [url, doi ? `https://doi.org/${doi}` : null]
    .filter(Boolean)
    .map((identifier) => `        <dc:identifier>${xmlEscape(identifier)}</dc:identifier>`)
    .join('\n');

  return `<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
        <dc:title>${xmlEscape(item.title ?? '')}</dc:title>
${creatorTags}
${subjectTags}
        <dc:description>${xmlEscape(item.abstract ?? '')}</dc:description>
        <dc:date>${xmlEscape(item.year ? String(item.year) : '')}</dc:date>
        <dc:type>${xmlEscape(item.item_type ?? item.type ?? 'Text')}</dc:type>
${identifierTags}
        <dc:language>${xmlEscape(item.language ?? 'English')}</dc:language>
        <dc:rights>${xmlEscape(item.license ?? 'CC BY 4.0 https://creativecommons.org/licenses/by/4.0/')}</dc:rights>
      </oai_dc:dc>`;
}

export function toDataCite(item: Record<string, unknown>, baseUrl: string): string {
  const authors = asArray(item.authors);
  const doi = (item.doi as string) ?? null;
  const url = itemUrl(item, baseUrl);

  const creatorTags = authors
    .map((author) => `      <creator><creatorName>${xmlEscape(author)}</creatorName></creator>`)
    .join('\n');
  const subjectTags = [...asArray(item.subjects), ...asArray(item.keywords)]
    .map((subject) => `      <subject>${xmlEscape(subject)}</subject>`)
    .join('\n');
  const year = item.year ? String(item.year) : (item.created_at ? new Date(String(item.created_at)).getFullYear().toString() : '');

  return `<resource xmlns="http://datacite.org/schema/kernel-4.4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://datacite.org/schema/kernel-4.4 https://schema.datacite.org/meta/kernel-4.4/metadata.xsd">
    <identifier identifierType="DOI">${xmlEscape(doi ?? url)}</identifier>
    <creators>
${creatorTags || '      <creator><creatorName>ESUT Library</creatorName></creator>'}
    </creators>
    <titles>
      <title>${xmlEscape(item.title ?? '')}</title>
    </titles>
    <publisher>ESUT Library</publisher>
    <publicationYear>${xmlEscape(year)}</publicationYear>
    <resourceType resourceTypeGeneral="${xmlEscape(resourceTypeGeneral(item))}">${xmlEscape(item.item_type ?? item.type ?? 'Text')}</resourceType>
${subjectTags ? `    <subjects>\n${subjectTags}\n    </subjects>` : ''}
    <dates>
      <date dateType="Created">${xmlEscape(item.created_at ? new Date(String(item.created_at)).toISOString().slice(0, 10) : '')}</date>
    </dates>
    <descriptions>
      <description descriptionType="Abstract">${xmlEscape(item.abstract ?? '')}</description>
    </descriptions>
    <rightsList>
      <rights rightsURI="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</rights>
    </rightsList>
    <relatedIdentifiers>
      <relatedIdentifier relatedIdentifierType="URL" relationType="IsSupplementedBy">${xmlEscape(url)}</relatedIdentifier>
    </relatedIdentifiers>
  </resource>`;
}

function resourceTypeGeneral(item: Record<string, unknown>): string {
  const type = String(item.item_type ?? item.type ?? '').toLowerCase();
  if (type.includes('thesis') || type.includes('dissertation')) return 'Thesis';
  if (type.includes('dataset')) return 'Dataset';
  if (type.includes('conference')) return 'ConferencePaper';
  if (type.includes('book')) return 'BookChapter';
  if (type.includes('journal') || type.includes('article')) return 'JournalArticle';
  return 'Text';
}

export function toMarcXml(item: Record<string, unknown>): string {
  const authors = asArray(item.authors);
  const doi = (item.doi as string) ?? null;
  const year = item.year ? String(item.year) : '';
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);

  const authorField = authors.length > 0
    ? `    <datafield tag="100" ind1="1" ind2=""><subfield code="a">${xmlEscape(authors.join('; '))}</subfield></datafield>\n`
    : '';
  const subjectFields = [...asArray(item.subjects), ...asArray(item.keywords)]
    .map((subject, index) => `    <datafield tag="650" ind1=" " ind2="0"><subfield code="a">${xmlEscape(subject)}</subfield></datafield>${index < asArray(item.subjects).length + asArray(item.keywords).length - 1 ? '\n' : ''}`)
    .join('');
  const doiField = doi
    ? `    <datafield tag="024" ind1="7" ind2=" "><subfield code="a">${xmlEscape(doi)}</subfield><subfield code="2">doi</subfield></datafield>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">
  <record>
    <leader>00000nam a2200000 a 4500</leader>
    <controlfield tag="001">${xmlEscape(item.id ?? '')}</controlfield>
    <controlfield tag="003">ESUT</controlfield>
    <controlfield tag="005">${timestamp}</controlfield>
    <datafield tag="040" ind1=" " ind2=" "><subfield code="a">ESUT</subfield><subfield code="b">eng</subfield></datafield>
${authorField}    <datafield tag="245" ind1="1" ind2="0"><subfield code="a">${xmlEscape(item.title ?? '')}</subfield></datafield>
    <datafield tag="260" ind1=" " ind2=" "><subfield code="c">${xmlEscape(year)}</subfield><subfield code="b">ESUT Library</subfield></datafield>
${subjectFields}${doiField}    <datafield tag="300" ind1=" " ind2=" "><subfield code="a">1 online resource</subfield></datafield>
    <datafield tag="520" ind1=" " ind2=" "><subfield code="a">${xmlEscape(item.abstract ?? '')}</subfield></datafield>
    <datafield tag="540" ind1=" " ind2=" "><subfield code="a">CC BY 4.0</subfield><subfield code="u">https://creativecommons.org/licenses/by/4.0/</subfield></datafield>
    <datafield tag="506" ind1=" " ind2=" "><subfield code="a">Open access</subfield></datafield>
  </record>
</collection>`;
}

export function toMetadata(prefix: MetadataPrefix, item: Record<string, unknown>, baseUrl: string): string {
  switch (prefix) {
    case 'datacite':
      return toDataCite(item, baseUrl);
    case 'marcxml':
      return toMarcXml(item);
    case 'oai_dc':
    default:
      return toDublinCore(item, baseUrl);
  }
}
