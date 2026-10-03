import type { YAZRecord } from './yazClient';

export interface ParsedMarcRecord {
  controlNumber: string;
  title: string;
  authors: string[];
  isbn: string | null;
  issn: string | null;
  publisher: string | null;
  placeOfPublication: string | null;
  year: number | null;
  edition: string | null;
  subjects: string[];
  callNumber: string | null;
  language: string | null;
  abstract: string | null;
  series: string | null;
  physicalDescription: string | null;
  notes: string[];
  raw: YAZRecord;
}

export function parseMarcRecord(record: YAZRecord): ParsedMarcRecord {
  const df = (tag: string) => record.fields.find(f => f.tag === tag && f.subfields);
  const cf = (tag: string) => record.fields.find(f => f.tag === tag && f.value)?.value || '';
  const sub = (tag: string, code: string) => df(tag)?.subfields?.find(s => s.code === code)?.value || '';
  const allSubs = (tag: string, code: string) =>
    record.fields.filter(f => f.tag === tag).flatMap(f => f.subfields?.filter(s => s.code === code).map(s => s.value) || []);

  const title = sub('245', 'a').replace(/\s*\/.*$/, '').trim();
  const authors = allSubs('100', 'a').concat(allSubs('700', 'a'));
  const isbn = sub('020', 'a').replace(/[^0-9X]/gi, '') || null;
  const issn = sub('022', 'a').replace(/[^0-9X]/gi, '') || null;
  const publisher = sub('260', 'b') || sub('264', 'b') || null;
  const place = sub('260', 'a') || sub('264', 'a') || null;
  const yearStr = sub('260', 'c') || sub('264', 'c') || '';
  const yearMatch = yearStr.match(/(18|19|20)\d{2}/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
  const edition = sub('250', 'a') || null;
  const subjects = allSubs('650', 'a').concat(allSubs('600', 'a'));
  const callNumber = sub('050', 'a') || sub('082', 'a') || null;
  const language = sub('041', 'a') || null;
  const abstract = sub('520', 'a') || null;
  const series = sub('490', 'a') || null;
  const physDesc = sub('300', 'a') || null;
  const notes = allSubs('500', 'a');

  return {
    controlNumber: cf('001'),
    title, authors, isbn, issn, publisher,
    placeOfPublication: place, year, edition, subjects,
    callNumber, language, abstract, series, physicalDescription: physDesc,
    notes, raw: record,
  };
}
