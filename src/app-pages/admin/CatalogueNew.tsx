import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabaseFunctionUrl } from '@/lib/env';
import { institutionConfig } from '@config/institution.config';
import { useAuth } from '@/hooks/useAuth';
import { CATALOG_ITEM_TYPES } from '@/lib/moduleSeparation';

// ─── MARC21 field definitions ─────────────────────────────────────────────────
const MARC_TAGS: Record<string, { label: string; repeatable: boolean; subfields: Record<string, string> }> = {
  '001': { label: 'Control Number', repeatable: false, subfields: {} },
  '003': { label: 'Control Number Identifier', repeatable: false, subfields: {} },
  '008': { label: 'Fixed-Length Data Elements', repeatable: false, subfields: {} },
  '020': { label: 'ISBN', repeatable: true, subfields: { a: 'ISBN', z: 'Cancelled/invalid ISBN', q: 'Qualifying information' } },
  '022': { label: 'ISSN', repeatable: true, subfields: { a: 'ISSN', z: 'Cancelled ISSN' } },
  '040': { label: 'Cataloguing Source', repeatable: false, subfields: { a: 'Original cataloguing agency', b: 'Language', c: 'Transcribing agency', e: 'Description conventions' } },
  '041': { label: 'Language Code', repeatable: true, subfields: { a: 'Language of text' } },
  '050': { label: 'Library of Congress Call Number', repeatable: true, subfields: { a: 'Classification number', b: 'Item number' } },
  '082': { label: 'Dewey Decimal Classification', repeatable: true, subfields: { a: 'Classification number', b: 'Item number' } },
  '100': { label: 'Main Entry – Personal Name', repeatable: false, subfields: { a: 'Personal name', b: 'Numeration', c: 'Titles/words', d: 'Dates', e: 'Relator term', q: 'Fuller form of name' } },
  '110': { label: 'Main Entry – Corporate Name', repeatable: false, subfields: { a: 'Corporate name', b: 'Subordinate unit' } },
  '245': { label: 'Title Statement', repeatable: false, subfields: { a: 'Title', b: 'Remainder of title', c: 'Statement of responsibility', n: 'Number of part', p: 'Name of part' } },
  '246': { label: 'Varying Form of Title', repeatable: true, subfields: { a: 'Title', b: 'Remainder of title', i: 'Display text' } },
  '250': { label: 'Edition Statement', repeatable: false, subfields: { a: 'Edition statement' } },
  '260': { label: 'Publication/Distribution (Legacy)', repeatable: true, subfields: { a: 'Place of publication', b: 'Publisher', c: 'Date' } },
  '264': { label: 'Production, Publication, Distribution', repeatable: true, subfields: { a: 'Place', b: 'Name', c: 'Date' } },
  '300': { label: 'Physical Description', repeatable: true, subfields: { a: 'Extent', b: 'Illustrations', c: 'Dimensions', e: 'Accompanying material' } },
  '336': { label: 'Content Type', repeatable: true, subfields: { a: 'Content type term', b: 'Content type code' } },
  '337': { label: 'Media Type', repeatable: true, subfields: { a: 'Media type term', b: 'Media type code' } },
  '338': { label: 'Carrier Type', repeatable: true, subfields: { a: 'Carrier type term', b: 'Carrier type code' } },
  '490': { label: 'Series Statement', repeatable: true, subfields: { a: 'Series statement', v: 'Volume number' } },
  '500': { label: 'General Note', repeatable: true, subfields: { a: 'Note' } },
  '504': { label: 'Bibliography Note', repeatable: true, subfields: { a: 'Note' } },
  '505': { label: 'Contents Note', repeatable: true, subfields: { a: 'Contents', t: 'Title', r: 'Statement of responsibility', g: 'Miscellaneous info' } },
  '520': { label: 'Summary/Abstract', repeatable: true, subfields: { a: 'Summary' } },
  '600': { label: 'Subject – Personal Name', repeatable: true, subfields: { a: 'Personal name', x: 'General subdivision', y: 'Chronological', z: 'Geographic' } },
  '610': { label: 'Subject – Corporate Name', repeatable: true, subfields: { a: 'Corporate name', x: 'General subdivision' } },
  '650': { label: 'Subject – Topical Term', repeatable: true, subfields: { a: 'Topical term', x: 'General subdivision', y: 'Chronological', z: 'Geographic', v: 'Form subdivision' } },
  '651': { label: 'Subject – Geographic Name', repeatable: true, subfields: { a: 'Geographic name', x: 'General subdivision' } },
  '700': { label: 'Added Entry – Personal Name', repeatable: true, subfields: { a: 'Personal name', e: 'Relator term', t: 'Title of work' } },
  '710': { label: 'Added Entry – Corporate Name', repeatable: true, subfields: { a: 'Corporate name', e: 'Relator term' } },
  '776': { label: 'Additional Physical Form', repeatable: true, subfields: { i: 'Relationship info', a: 'Main entry heading', t: 'Title', d: 'Place, publisher, date', z: 'ISBN' } },
  '856': { label: 'Electronic Location and Access', repeatable: true, subfields: { u: 'URI', z: 'Public note', y: 'Link text', 3: 'Material specified' } },
};

const DEFAULT_MARC_FIELDS = [
  { tag: '100', ind1: '1', ind2: ' ', subfields: [{ code: 'a', value: '' }] },
  { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: '' }, { code: 'b', value: '' }, { code: 'c', value: '' }] },
  { tag: '264', ind1: ' ', ind2: '1', subfields: [{ code: 'a', value: '' }, { code: 'b', value: '' }, { code: 'c', value: '' }] },
  { tag: '300', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '' }] },
  { tag: '020', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '' }] },
  { tag: '650', ind1: ' ', ind2: '0', subfields: [{ code: 'a', value: '' }] },
];

const Z3950_SOURCES = [
  { id: 'loc', label: 'Library of Congress', url: 'https://lx2.loc.gov:210/LCDB' },
  { id: 'bl', label: 'British Library', url: 'https://z3950.bl.uk:9909/BLAC' },
  { id: 'worldcat', label: 'WorldCat', url: 'https://www.worldcat.org/search' },
  { id: 'ddc', label: 'Dewey Decimal Classification', url: 'https://www.oclc.org/dewey' },
];

const FORMATS = CATALOG_ITEM_TYPES;

function extractPublicationYear(value: unknown): number | null {
  const match = String(value ?? '').match(/(?:18|19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function firstText(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstText(value[0]);
  if (typeof value === 'object') return firstText(value.value ?? value.name ?? value.text);
  return String(value);
}

function joinTexts(value: any): string {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(firstText).filter(Boolean).join('; ');
  return firstText(value);
}

function externalCatalogueLinks(identifier: string) {
  const q = encodeURIComponent(identifier);
  return [
    `Library of Congress: https://www.loc.gov/books/?all=true&fo=json&q=${q}`,
    `WorldCat: https://search.worldcat.org/search?q=${q}`,
    `Dewey/OCLC Classify: https://classify.oclc.org/classify2/Classify?isbn=${q}&summary=true`,
  ].join('\n');
}

async function lookupLocRecord(identifier: string) {
  const q = encodeURIComponent(identifier);
  const res = await fetch(`https://www.loc.gov/books/?fo=json&c=5&all=true&q=${q}`);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.results?.find((r: any) => String(r?.number ?? '').includes(identifier) || String(r?.isbn ?? '').includes(identifier) || String(r?.issn ?? '').includes(identifier)) ?? data.results?.[0];
  if (!item) return null;
  const subjectValues = Array.isArray(item.subject) ? item.subject : [];
  const lcc = firstText(item.call_number ?? item.lccn ?? item.classification_lcc);
  return {
    title: item.title ?? '',
    authors: joinTexts(item.contributor ?? item.creator),
    publisher: firstText(item.publisher),
    place_of_publication: firstText(item.location),
    year: extractPublicationYear(item.date) ?? undefined,
    subjects: subjectValues.slice(0, 8).join('; '),
    language: firstText(item.language) || undefined,
    abstract: firstText(item.description),
    notes: `Metadata enriched from Library of Congress.\n${externalCatalogueLinks(identifier)}`,
    call_number: lcc,
    lcc_number: lcc,
  } as Partial<SimpleForm>;
}

async function lookupDeweyNumber(isbn: string) {
  const res = await fetch(`https://classify.oclc.org/classify2/Classify?isbn=${encodeURIComponent(isbn)}&summary=true`);
  if (!res.ok) return '';
  const xml = await res.text();
  return xml.match(/ddc="([^"]+)"/)?.[1] ?? xml.match(/mostPopular="([^"]+)"/)?.[1] ?? '';
}

interface SimpleForm {
  isbn: string; title: string; authors: string; publisher: string;
  place_of_publication: string; year: number; edition: string; subjects: string;
  format: string; language: string; copies: number; faculty_code: string;
  call_number: string; lcc_number: string; dewey_number: string; abstract: string; series: string; physical_description: string;
  notes: string; cover_image: string;
  library_slug: string; library_code: string; shelf_code: string; location_notes: string;
  visibility: 'global' | 'members' | 'private';
}

interface MarcField {
  tag: string; ind1: string; ind2: string;
  subfields: { code: string; value: string }[];
}

export default function CatalogueNew() {
  const navigate = useNavigate();
  const { loading: authLoading, hasRole } = useAuth();
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [saving, setSaving] = useState(false);
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [isbnSource, setIsbnSource] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [z3950Open, setZ3950Open] = useState(false);
  const [z3950Query, setZ3950Query] = useState('');
  const [z3950Source, setZ3950Source] = useState('loc');
  const [z3950Results, setZ3950Results] = useState<any[]>([]);
  const [z3950Searching, setZ3950Searching] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Shelf options filtered by selected library
  const [availableShelves, setAvailableShelves] = useState<{ shelf_code: string; description: string }[]>([]);
  const [shelvesLoading, setShelvesLoading] = useState(false);

  const ALL_LIBRARIES = [
    { code: institutionConfig.mainLibrary.code, name: institutionConfig.mainLibrary.name, slug: institutionConfig.mainLibrary.slug },
    ...institutionConfig.branchLibraries.map(l  => ({ code: l.code, name: l.name, slug: l.slug })),
    ...institutionConfig.facultyLibraries.map(l => ({ code: l.code, name: l.name, slug: l.slug })),
  ];

  const [form, setForm] = useState<SimpleForm>({
    isbn: '', title: '', authors: '', publisher: '', place_of_publication: '',
    year: new Date().getFullYear(), edition: '1st', subjects: '', format: 'Book',
    language: 'English', copies: 1, faculty_code: institutionConfig.faculties[0]?.code ?? '',
    call_number: '', lcc_number: '', dewey_number: '', abstract: '', series: '', physical_description: '', notes: '', cover_image: '',
    library_slug: institutionConfig.mainLibrary.slug,
    library_code: institutionConfig.mainLibrary.code,
    shelf_code: '', location_notes: '', visibility: 'global',
  });

  const [marcFields, setMarcFields] = useState<MarcField[]>(DEFAULT_MARC_FIELDS.map(f => ({ ...f, subfields: f.subfields.map(s => ({ ...s })) })));

  // Load librarian's saved mode preference
  useEffect(() => {
    const saved = localStorage.getItem('marc_mode_preference');
    if (saved === 'simple' || saved === 'advanced') setMode(saved);
  }, []);

  // Load shelves when library selection changes
  useEffect(() => {
    if (!form.library_slug) return;
    setShelvesLoading(true);
    setForm(p => ({ ...p, shelf_code: '' }));
    supabase.from('library_shelves')
      .select('shelf_code, description')
      .eq('library_slug', form.library_slug)
      .eq('status', 'active')
      .order('shelf_code')
      .then(({ data }) => {
        setAvailableShelves((data ?? []) as { shelf_code: string; description: string }[]);
        setShelvesLoading(false);
      });
  }, [form.library_slug]);

  const switchMode = (m: 'simple' | 'advanced') => {
    setMode(m);
    localStorage.setItem('marc_mode_preference', m);
    if (m === 'advanced') syncSimpleToMarc();
  };

  // ── ISBN Auto-fill ──────────────────────────────────────────────────────────
  const autoFillISBN = async () => {
    const isbn = form.isbn.replace(/[-\s]/g, '');
    if (!isbn) return;
    setIsbnLoading(true);
    setIsbnSource(null);
    try {
      const isIssn = /^\d{4}-?\d{3}[\dXx]$/.test(isbn) && !/^\d{10}$|^\d{13}$/.test(isbn);
      const bibKey = isIssn ? `ISSN:${isbn}` : `ISBN:${isbn}`;
      const locPromise = lookupLocRecord(isbn).catch(() => null);
      const deweyPromise = isIssn ? Promise.resolve('') : lookupDeweyNumber(isbn).catch(() => '');

      // 1. Try Open Library
      const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=${bibKey}&format=json&jscmd=data`);
      const olData = await olRes.json();
      const olBook = olData[bibKey];
      if (olBook) {
        const [locData, deweyNumber] = await Promise.all([locPromise, deweyPromise]);
        applyBookData({
          ...locData,
          title: olBook.title,
          authors: olBook.authors?.map((a: any) => a.name).join(', ') ?? '',
          publisher: olBook.publishers?.[0]?.name ?? '',
          place_of_publication: olBook.publish_places?.[0]?.name ?? '',
          year: extractPublicationYear(olBook.publish_date) ?? form.year,
          subjects: olBook.subjects?.map((s: any) => s.name ?? s).join('; ') ?? '',
          cover_image: olBook.cover?.large ?? olBook.cover?.medium ?? '',
          abstract: firstText(olBook.description ?? olBook.notes),
          series: joinTexts(olBook.series),
          physical_description: [olBook.number_of_pages ? `${olBook.number_of_pages} pages` : '', olBook.physical_format, olBook.physical_dimensions].filter(Boolean).join(' ; '),
          notes: [joinTexts(olBook.notes) || `Metadata imported from Open Library for ${bibKey}.`, externalCatalogueLinks(isbn)].join('\n'),
          call_number: firstText(olBook.classifications?.lc_classifications ?? olBook.lc_classifications) || locData?.call_number,
          lcc_number: firstText(olBook.classifications?.lc_classifications ?? olBook.lc_classifications) || locData?.lcc_number,
          dewey_number: firstText(olBook.classifications?.dewey_decimal_class ?? olBook.dewey_decimal_class) || deweyNumber,
        });
        setIsbnSource(`Open Library${locData ? ' + Library of Congress' : ''}${deweyNumber ? ' + Dewey/OCLC' : ''}`);
        return;
      }

      // 2. Fallback: Library of Congress
      const locData = await locPromise;
      if (locData) {
        const deweyNumber = await deweyPromise;
        applyBookData({ ...locData, dewey_number: deweyNumber || locData.dewey_number });
        setIsbnSource(`Library of Congress${deweyNumber ? ' + Dewey/OCLC' : ''}`);
        return;
      }

      // 3. Fallback: Google Books
      const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${isIssn ? 'issn' : 'isbn'}:${isbn}`);
      const gbData = await gbRes.json();
      const gbItem = gbData.items?.[0]?.volumeInfo;
      if (gbItem) {
        const deweyNumber = await deweyPromise;
        applyBookData({
          title: gbItem.title ?? '',
          authors: gbItem.authors?.join(', ') ?? '',
          publisher: gbItem.publisher ?? '',
          place_of_publication: '',
          year: extractPublicationYear(gbItem.publishedDate) ?? form.year,
          subjects: gbItem.categories?.join('; ') ?? '',
          cover_image: gbItem.imageLinks?.thumbnail?.replace('http:', 'https:') ?? '',
          series: joinTexts(gbItem.seriesInfo ?? gbItem.series),
          physical_description: [gbItem.pageCount ? `${gbItem.pageCount} pages` : '', gbItem.printType].filter(Boolean).join(' ; '),
          abstract: gbItem.description ?? '',
          notes: [`Metadata imported from Google Books${gbItem.infoLink ? `: ${gbItem.infoLink}` : ''}`, externalCatalogueLinks(isbn)].join('\n'),
          dewey_number: deweyNumber,
        });
        setIsbnSource(`Google Books${deweyNumber ? ' + Dewey/OCLC' : ''}`);
      } else {
        setErrorMsg('No data found for this ISBN/ISSN. Please fill in manually.');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch {
      setErrorMsg('Failed to fetch ISBN data. Check your internet connection.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsbnLoading(false);
    }
  };

  const applyBookData = (data: Partial<SimpleForm>) => {
    setForm(prev => ({ ...prev, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== undefined)) }));
  };

  // ── AI Subject Headings ─────────────────────────────────────────────────────
  const suggestSubjects = async () => {
    if (!form.title) return;
    setAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setAiLoading(false); return; }
      const res = await fetch(supabaseFunctionUrl('ai-librarian'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          message: `Suggest 5–8 LCSH (Library of Congress Subject Headings) for a book titled "${form.title}" by ${form.authors || 'unknown author'}. Return only the subject headings as a semicolon-separated list, nothing else.`,
        }),
      });
      if (res.ok) {
        const { reply } = await res.json();
        if (reply) {
          const subjects = reply.replace(/\n/g, ';').split(/[;,]/).map((s: string) => s.trim()).filter(Boolean).join('; ');
          setForm(prev => ({ ...prev, subjects: prev.subjects ? `${prev.subjects}; ${subjects}` : subjects }));
        }
      }
    } catch { /* silent */ } finally { setAiLoading(false); }
  };

  // ── Z39.50 Copy Cataloguing ─────────────────────────────────────────────────
  const z3950Search = async () => {
    setZ3950Searching(true);
    setZ3950Results([]);
    try {
      // Use Open Library as Z39.50 proxy (real Z39.50 requires server-side)
      const q = z3950Query.replace(/[-\s]/g, '');
      const isISBN = /^\d{10,13}$/.test(q);
      let url = isISBN
        ? `https://openlibrary.org/api/books?bibkeys=ISBN:${q}&format=json&jscmd=data`
        : `https://openlibrary.org/search.json?q=${encodeURIComponent(z3950Query)}&limit=5`;

      const res = await fetch(url);
      const data = await res.json();

      if (isISBN) {
        const book = data[`ISBN:${q}`];
        if (book) setZ3950Results([{ ...book, _isbn: q }]);
      } else {
        const docs = data.docs ?? [];
        setZ3950Results(docs.slice(0, 5).map((d: any) => ({
          title: d.title,
          authors: d.author_name?.map((a: string) => ({ name: a })) ?? [],
          publishers: d.publisher?.map((p: string) => ({ name: p })) ?? [],
          publish_date: d.first_publish_year?.toString() ?? '',
          subjects: d.subject?.slice(0, 8).map((s: string) => ({ name: s })) ?? [],
          _isbn: d.isbn?.[0] ?? '',
        })));
      }
    } catch {
      setErrorMsg('Search failed. Please try again.');
      setTimeout(() => setErrorMsg(''), 3000);
    } finally { setZ3950Searching(false); }
  };

  const importZ3950Record = (record: any) => {
    applyBookData({
      title: record.title ?? '',
      authors: record.authors?.map((a: any) => a.name).join(', ') ?? '',
      publisher: record.publishers?.[0]?.name ?? '',
      place_of_publication: record.publish_places?.[0]?.name ?? '',
      year: extractPublicationYear(record.publish_date) ?? form.year,
      subjects: record.subjects?.map((s: any) => s.name ?? s).join('; ') ?? '',
      isbn: record._isbn ?? form.isbn,
      cover_image: record.cover?.large ?? record.cover?.medium ?? '',
    });
    if (mode === 'advanced') syncSimpleToMarc();
    setZ3950Open(false);
    setSuccessMsg(`Record imported from ${Z3950_SOURCES.find(s => s.id === z3950Source)?.label ?? 'external source'}.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // ── Sync simple form → MARC fields ─────────────────────────────────────────
  const syncSimpleToMarc = () => {
    const newFields: MarcField[] = [...DEFAULT_MARC_FIELDS.map(f => ({ ...f, subfields: f.subfields.map(s => ({ ...s })) }))];
    const set = (tag: string, codes: Record<string, string>) => {
      const f = newFields.find(x => x.tag === tag);
      if (f) f.subfields = Object.entries(codes).map(([code, value]) => ({ code, value }));
    };

    const authors = form.authors.split(',').map(a => a.trim()).filter(Boolean);
    set('100', { a: authors[0] ?? '' });
    set('245', { a: form.title, b: '', c: authors.join(', ') });
    set('264', { a: form.place_of_publication, b: form.publisher, c: form.year.toString() });
    set('300', { a: form.physical_description || 'pages ;' });
    set('020', { a: form.isbn });
    if (form.lcc_number) set('050', { a: form.lcc_number, b: '' });
    if (form.dewey_number) set('082', { a: form.dewey_number, b: '' });
    if (form.subjects) {
      const subjectFields = form.subjects.split(/[;,]/).filter(Boolean).map(s => ({
        tag: '650', ind1: ' ', ind2: '0', subfields: [{ code: 'a', value: s.trim() }],
      }));
      newFields.splice(newFields.findIndex(f => f.tag === '650'), 1, ...subjectFields);
    }
    // Add extra authors as 700
    authors.slice(1).forEach(a => {
      newFields.push({ tag: '700', ind1: '1', ind2: ' ', subfields: [{ code: 'a', value: a }] });
    });
    if (form.series) newFields.push({ tag: '490', ind1: '0', ind2: ' ', subfields: [{ code: 'a', value: form.series }] });
    if (form.abstract) newFields.push({ tag: '520', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: form.abstract }] });
    if (form.notes) newFields.push({ tag: '500', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: form.notes }] });

    setMarcFields(newFields);
  };

  // ── MARC field management ───────────────────────────────────────────────────
  const addMarcField = (tag = '') => {
    setMarcFields(prev => [...prev, { tag, ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '' }] }]);
  };

  const removeMarcField = (i: number) => setMarcFields(prev => prev.filter((_, idx) => idx !== i));

  const updateMarcField = (i: number, patch: Partial<MarcField>) =>
    setMarcFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  const addSubfield = (fi: number) =>
    setMarcFields(prev => prev.map((f, i) => i === fi ? { ...f, subfields: [...f.subfields, { code: '', value: '' }] } : f));

  const removeSubfield = (fi: number, si: number) =>
    setMarcFields(prev => prev.map((f, i) => i === fi ? { ...f, subfields: f.subfields.filter((_, idx) => idx !== si) } : f));

  const updateSubfield = (fi: number, si: number, patch: Partial<{ code: string; value: string }>) =>
    setMarcFields(prev => prev.map((f, i) => i === fi
      ? { ...f, subfields: f.subfields.map((s, j) => j === si ? { ...s, ...patch } : s) }
      : f));

  // ── Build MARC21 JSON from fields ───────────────────────────────────────────
  const buildMarc21 = () => marcFields.reduce((acc: any, f) => {
    acc[f.tag] = { ind1: f.ind1, ind2: f.ind2, subfields: f.subfields.reduce((s: any, sf) => { s[sf.code] = sf.value; return s; }, {}) };
    return acc;
  }, { leader: '00000nam a2200000 i 4500' });

  // ── Extract simple values from MARC ────────────────────────────────────────
  const getMarc = (tag: string, code: string) => {
    const f = marcFields.find(x => x.tag === tag);
    return f?.subfields.find(s => s.code === code)?.value ?? '';
  };

  const lookupQuery = encodeURIComponent(form.isbn || form.title || z3950Query || '');
  const externalLookups = [
    { label: 'Library of Congress Classification', href: `https://catalog.loc.gov/vwebv/search?searchArg=${lookupQuery}&searchCode=GKEY%5E*&searchType=0` },
    { label: 'WorldCat / World Catalogue', href: `https://www.worldcat.org/search?q=${lookupQuery}` },
    { label: 'Dewey Decimal Classification', href: `https://search.worldcat.org/search?q=${lookupQuery}` },
  ];

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    const title = mode === 'simple' ? form.title : getMarc('245', 'a');
    if (!title.trim()) { setErrorMsg('Title is required.'); return; }
    setSaving(true);
    try {
      let payload: any;
      if (mode === 'simple') {
        const authorsArr = form.authors.split(',').map(a => a.trim()).filter(Boolean);
        const subjectsArr = form.subjects.split(/[;,]/).map(s => s.trim()).filter(Boolean);
        payload = {
          title: form.title, authors: authorsArr, isbn: form.isbn || null,
          publisher: form.publisher, place_of_publication: form.place_of_publication || null,
          year: extractPublicationYear(form.year) ?? null, edition: form.edition || null, subjects: subjectsArr,
          format: form.format, language: form.language, total_copies: form.copies,
          available_copies: form.copies, faculty_code: form.faculty_code || null,
          call_number: form.call_number || form.lcc_number || form.dewey_number || null, abstract: form.abstract || null,
          series: form.series || null, physical_description: form.physical_description || null,
          notes: form.notes || null, cover_image: form.cover_image || null,
          marc21_fields: buildMarc21(),
          library_slug: form.library_slug || null, library_code: form.library_code || null,
          shelf_code: form.shelf_code || null, location_notes: form.location_notes || null,
          branch_origin: form.library_code || null,
          visibility: form.visibility,
        };
      } else {
        const authors245c = getMarc('245', 'c');
        const author100 = getMarc('100', 'a');
        const authors700 = marcFields.filter(f => f.tag === '700').map(f => f.subfields.find(s => s.code === 'a')?.value ?? '').filter(Boolean);
        const allAuthors = [author100, ...authors700].filter(Boolean);
        const subjects650 = marcFields.filter(f => f.tag === '650').map(f => f.subfields.find(s => s.code === 'a')?.value ?? '').filter(Boolean);
        const isbn020 = getMarc('020', 'a');
        const pub264b = getMarc('264', 'b');
        const place264a = getMarc('264', 'a');
        const year264c = getMarc('264', 'c');
        const phys300a = getMarc('300', 'a');

        payload = {
          title: getMarc('245', 'a'), authors: allAuthors.length ? allAuthors : [authors245c],
          isbn: isbn020 || null, publisher: pub264b || null, place_of_publication: place264a || null,
          year: extractPublicationYear(year264c), edition: getMarc('250', 'a') || null,
          subjects: subjects650, format: form.format, language: form.language,
          total_copies: form.copies, available_copies: form.copies,
          faculty_code: form.faculty_code || null, call_number: form.call_number || getMarc('050', 'a') || getMarc('082', 'a') || null,
          abstract: getMarc('520', 'a') || null, series: getMarc('490', 'a') || null,
          physical_description: phys300a || null, notes: getMarc('500', 'a') || null,
          cover_image: form.cover_image || null, marc21_fields: buildMarc21(),
          library_slug: form.library_slug || null, library_code: form.library_code || null,
          shelf_code: form.shelf_code || null, location_notes: form.location_notes || null,
          branch_origin: form.library_code || null,
          visibility: form.visibility,
        };
      }

      const { data, error } = await supabase.from('catalogue_items').insert(payload).select('id').single();
      if (error) throw error;

      // Log Z39.50 import if applicable
      if (isbnSource) {
        await supabase.from('z3950_imports').insert({
          source: isbnSource, query: form.isbn, isbn: form.isbn,
          marc21_data: payload.marc21_fields,
        }).throwOnError();
      }

      navigate(`/admin/catalogue`);
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Failed to save. Please try again.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally { setSaving(false); }
  };

  if (authLoading) return <div className="p-8 text-sm text-neutral-500">Loading...</div>;
  if (!hasRole('super_admin', 'catalog_admin', 'librarian', 'faculty_librarian')) return <div className="p-8"><div className="card p-8 max-w-lg"><h1 className="font-semibold text-lg mb-2">Catalog access required</h1><p className="text-sm text-neutral-600">Only catalog administrators and librarians can add OPAC records.</p></div></div>;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Add Catalog Item</h1>
          <p className="text-neutral-500 mt-1">Create a MARC-based OPAC record for purchased or held library materials. Repository deposits use Admin &gt; Deposit to IR.</p>
        </div>
        <div className="flex gap-2">
          {externalLookups.map((source) => (
            <a key={source.label} href={source.href} target="_blank" rel="noopener noreferrer" className={`btn-outline hidden text-xs lg:inline-flex ${!lookupQuery ? 'pointer-events-none opacity-50' : ''}`}>
              {source.label}
            </a>
          ))}
          <button onClick={() => setZ3950Open(true)}
            className="btn-outline flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Z39.50 Copy Cataloguing
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && <div className="bg-success-50 border border-success-200 text-success-700 text-sm px-4 py-3 rounded-lg">{successMsg}</div>}
      {errorMsg && <div className="bg-error-50 border border-error-200 text-error-700 text-sm px-4 py-3 rounded-lg">{errorMsg}</div>}
      {isbnSource && <div className="bg-primary-50 border border-primary-200 text-primary-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        Data auto-filled from {isbnSource}. Review and save.
      </div>}

      {/* Mode toggle */}
      <div className="card p-1 flex gap-1 max-w-sm">
        {(['simple', 'advanced'] as const).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            className={`flex-1 px-5 py-2 rounded-lg font-medium text-sm transition-all ${mode === m ? 'bg-primary-700 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'}`}>
            {m === 'simple' ? 'Simple Mode' : 'Advanced MARC21'}
          </button>
        ))}
      </div>

      {/* ── SIMPLE MODE ──────────────────────────────────────────────────────── */}
      {mode === 'simple' && (
        <div className="card p-6 space-y-6">
          {/* ISBN row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="label">ISBN / ISSN</label>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g. 978-0-13-468599-1" className="input flex-1"
                  value={form.isbn} onChange={e => setForm(p => ({ ...p, isbn: e.target.value }))} />
                <button onClick={autoFillISBN} disabled={isbnLoading || !form.isbn.trim()} className="btn-primary disabled:opacity-50 whitespace-nowrap">
                  {isbnLoading ? <Spinner /> : 'Smart Add'}
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-1">Smart Add fills ISBN/ISSN metadata from Open Library then Google Books. Leave blank for Manual Add.</p>
            </div>
            <div>
              <label className="label">Format</label>
              <select className="input" value={form.format} onChange={e => setForm(p => ({ ...p, format: e.target.value }))}>
                {FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="label">Title <span className="text-error-500">*</span></label>
              <input type="text" className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Full title including subtitle" />
            </div>
            <div>
              <label className="label">Authors</label>
              <input type="text" className="input" value={form.authors} onChange={e => setForm(p => ({ ...p, authors: e.target.value }))} placeholder="Last, First; Last, First" />
            </div>
            <div>
              <label className="label">Edition</label>
              <input type="text" className="input" value={form.edition} onChange={e => setForm(p => ({ ...p, edition: e.target.value }))} placeholder="e.g. 3rd" />
            </div>
            <div>
              <label className="label">Publisher</label>
              <input type="text" className="input" value={form.publisher} onChange={e => setForm(p => ({ ...p, publisher: e.target.value }))} />
            </div>
            <div>
              <label className="label">Place of Publication</label>
              <input type="text" className="input" value={form.place_of_publication} onChange={e => setForm(p => ({ ...p, place_of_publication: e.target.value }))} placeholder="e.g. Lagos, Nigeria" />
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" className="input" value={form.year} onChange={e => setForm(p => ({ ...p, year: +e.target.value }))} min={1800} max={2099} />
            </div>
            <div>
              <label className="label">Language</label>
              <select className="input" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
                {['English', 'French', 'Arabic', 'Yoruba', 'Hausa', 'Igbo', 'Portuguese', 'German'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Subject headings */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Subject Headings</label>
              <button onClick={suggestSubjects} disabled={aiLoading || !form.title}
                className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 disabled:opacity-40">
                {aiLoading ? <Spinner small /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                AI Suggest (LCSH)
              </button>
            </div>
            <textarea className="input font-mono text-sm" rows={3}
              value={form.subjects} onChange={e => setForm(p => ({ ...p, subjects: e.target.value }))}
              placeholder="Semicolon-separated subject headings, e.g. Education, Higher -- Nigeria; Teacher training" />
          </div>

          <div>
            <label className="label">Abstract / Summary</label>
            <textarea className="input" rows={4} value={form.abstract} onChange={e => setForm(p => ({ ...p, abstract: e.target.value }))} placeholder="Brief description of the item" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="label">Call Number</label>
              <input type="text" className="input font-mono" value={form.call_number} onChange={e => setForm(p => ({ ...p, call_number: e.target.value }))} placeholder="e.g. LB2395 .A34 2020" />
            </div>
            <div>
              <label className="label">Library of Congress Classification</label>
              <input type="text" className="input font-mono" value={form.lcc_number} onChange={e => setForm(p => ({ ...p, lcc_number: e.target.value }))} placeholder="MARC 050, e.g. LB2395" />
            </div>
            <div>
              <label className="label">Dewey Decimal Classification</label>
              <input type="text" className="input font-mono" value={form.dewey_number} onChange={e => setForm(p => ({ ...p, dewey_number: e.target.value }))} placeholder="MARC 082, e.g. 370.15" />
            </div>
          </div>

          <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-primary-800">Copy Cataloguing & Classification Lookup</h3>
                <p className="text-xs text-primary-700/80 mt-1">Use ISBN or title to check LOC, WorldCat, and Dewey sources before saving.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {externalLookups.map((source) => (
                  <a key={source.label} href={source.href} target="_blank" rel="noopener noreferrer" className={`btn-outline bg-white text-xs ${!lookupQuery ? 'pointer-events-none opacity-50' : ''}`}>
                    {source.label}
                  </a>
                ))}
                <button onClick={() => setZ3950Open(true)} className="btn-primary text-xs">Z39.50 Import</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="label">Faculty / Collection</label>
              <select className="input" value={form.faculty_code} onChange={e => setForm(p => ({ ...p, faculty_code: e.target.value }))}>
                <option value="">General Collection</option>
                {institutionConfig.faculties.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Number of Copies</label>
              <input type="number" className="input" value={form.copies} min={1} onChange={e => setForm(p => ({ ...p, copies: +e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="label">Series</label>
              <input type="text" className="input" value={form.series} onChange={e => setForm(p => ({ ...p, series: e.target.value }))} placeholder="Series title" />
            </div>
            <div>
              <label className="label">Physical Description</label>
              <input type="text" className="input" value={form.physical_description} onChange={e => setForm(p => ({ ...p, physical_description: e.target.value }))} placeholder="e.g. xii, 340 pages : illustrations ; 24 cm" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <input type="text" className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="General notes (bibliography, index, etc.)" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Cover Image URL</label>
              <input type="url" className="input" value={form.cover_image} onChange={e => setForm(p => ({ ...p, cover_image: e.target.value }))} placeholder="https://…" />
            </div>
          </div>

          {/* MARC preview for simple mode */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-primary-600 hover:text-primary-800 font-medium select-none">
              Preview generated MARC21 record ▾
            </summary>
            <div className="mt-3 bg-neutral-900 text-green-300 font-mono text-xs rounded-xl p-4 overflow-x-auto">
              <pre>{JSON.stringify(buildMarc21(), null, 2)}</pre>
            </div>
          </details>

          {/* ── Location & Visibility ─────────────────────────────────────── */}
          <div className="border-t border-neutral-100 pt-5 space-y-4">
            <h3 className="font-semibold text-neutral-800">Physical Location &amp; Visibility</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {institutionConfig.libraryMode === 'multi' && ALL_LIBRARIES.length > 1 && (
                <div>
                  <label className="label">Library Branch</label>
                  <select className="input" value={form.library_slug} onChange={e => {
                    const lib = ALL_LIBRARIES.find(l => l.slug === e.target.value);
                    setForm(p => ({ ...p, library_slug: e.target.value, library_code: lib?.code ?? '' }));
                  }}>
                    {ALL_LIBRARIES.map(l => <option key={l.slug} value={l.slug}>{l.code} — {l.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Shelf Location</label>
                {shelvesLoading ? (
                  <div className="input bg-neutral-50 text-neutral-400 text-sm">Loading shelves…</div>
                ) : availableShelves.length === 0 ? (
                  <div className="input bg-amber-50 text-amber-700 text-sm flex items-center gap-2">
                    <span>No shelves for this library.</span>
                    <a href="/admin/shelves" target="_blank" className="underline text-xs">Add shelves →</a>
                  </div>
                ) : (
                  <select className="input" value={form.shelf_code} onChange={e => setForm(p => ({ ...p, shelf_code: e.target.value }))}>
                    <option value="">— Select shelf (optional) —</option>
                    {availableShelves.map(s => (
                      <option key={s.shelf_code} value={s.shelf_code}>{s.shelf_code}{s.description ? ` — ${s.description}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="label">Specific Location Notes</label>
                <input type="text" className="input" value={form.location_notes}
                  onChange={e => setForm(p => ({ ...p, location_notes: e.target.value }))}
                  placeholder="e.g. Top shelf, left side — Oversize section" />
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="label">Visibility</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { value: 'global',  icon: '🌍', title: 'Global',       desc: 'Visible to everyone including non-logged-in visitors. Default for most items.' },
                  { value: 'members', icon: '🔒', title: 'Members Only', desc: 'Logged-in registered patrons only. Non-members see a padlock badge.' },
                  { value: 'private', icon: '🔐', title: 'Private',      desc: 'Staff only — hidden from /catalogue and all patron-facing pages.' },
                ] as const).map(v => (
                  <label key={v.value} className={`flex gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.visibility === v.value ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                    <input type="radio" name="visibility" value={v.value} checked={form.visibility === v.value}
                      onChange={() => setForm(p => ({ ...p, visibility: v.value }))} className="mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-neutral-800">{v.icon} {v.title}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{v.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-neutral-100">
            <a href="/admin/catalogue" className="btn-ghost">Cancel</a>
            <button onClick={save} disabled={saving || !form.title} className="btn-primary disabled:opacity-50">
              {saving ? <><Spinner /> Saving…</> : 'Save Catalogue Record'}
            </button>
          </div>
        </div>
      )}

      {/* ── ADVANCED MARC21 MODE ─────────────────────────────────────────────── */}
      {mode === 'advanced' && (
        <div className="space-y-4">
          <div className="card p-4 bg-neutral-900 text-green-400">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-mono text-xs font-semibold tracking-wider uppercase">MARC21 Bibliographic Editor</span>
              <span className="text-neutral-500 font-mono text-xs ml-auto">Leader: 00000nam a2200000 i 4500</span>
            </div>
            <p className="text-neutral-400 text-xs font-mono">Field-by-field MARC21 record. Each tag has two indicator positions and one or more subfield codes.</p>
          </div>

          {/* Common fields quick-fill */}
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Item Settings</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="label">Format</label>
                <select className="input text-sm" value={form.format} onChange={e => setForm(p => ({ ...p, format: e.target.value }))}>
                  {['Book', 'E-Book', 'Journal', 'Thesis', 'Report', 'Map', 'Video'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Language</label>
                <select className="input text-sm" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
                  {['English', 'French', 'Arabic', 'Yoruba', 'Hausa', 'Igbo'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Faculty</label>
                <select className="input text-sm" value={form.faculty_code} onChange={e => setForm(p => ({ ...p, faculty_code: e.target.value }))}>
                  <option value="">General</option>
                  {institutionConfig.faculties.map(f => <option key={f.code} value={f.code}>{f.code}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Copies</label>
                <input type="number" className="input text-sm" value={form.copies} min={1} onChange={e => setForm(p => ({ ...p, copies: +e.target.value }))} />
              </div>
              <div>
                <label className="label">Call Number</label>
                <input type="text" className="input text-sm font-mono" value={form.call_number} onChange={e => setForm(p => ({ ...p, call_number: e.target.value }))} placeholder="e.g. LB2395 .A34" />
              </div>
              <div>
                <label className="label">Cover Image URL</label>
                <input type="url" className="input text-sm" value={form.cover_image} onChange={e => setForm(p => ({ ...p, cover_image: e.target.value }))} placeholder="https://…" />
              </div>
            </div>
          </div>

          {/* MARC fields */}
          <div className="space-y-2">
            {marcFields.map((field, fi) => {
              const tagDef = MARC_TAGS[field.tag];
              return (
                <div key={fi} className="card border border-neutral-200 overflow-hidden">
                  {/* Tag header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border-b border-neutral-200">
                    <input type="text" maxLength={3}
                      className="w-14 text-center font-mono text-sm font-bold border border-neutral-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white"
                      value={field.tag} onChange={e => updateMarcField(fi, { tag: e.target.value })}
                      placeholder="tag" />
                    <span className="text-xs text-neutral-500 font-medium flex-1 truncate">
                      {tagDef?.label ?? (field.tag ? `Tag ${field.tag}` : 'Unknown tag')}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-neutral-400 font-mono">Ind1</span>
                      <input type="text" maxLength={1}
                        className="w-7 text-center font-mono text-xs border border-neutral-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white"
                        value={field.ind1} onChange={e => updateMarcField(fi, { ind1: e.target.value || ' ' })} />
                      <span className="text-xs text-neutral-400 font-mono">Ind2</span>
                      <input type="text" maxLength={1}
                        className="w-7 text-center font-mono text-xs border border-neutral-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white"
                        value={field.ind2} onChange={e => updateMarcField(fi, { ind2: e.target.value || ' ' })} />
                    </div>
                    <button onClick={() => removeMarcField(fi)} className="text-neutral-300 hover:text-error-500 transition-colors ml-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  {/* Subfields */}
                  <div className="p-3 space-y-2">
                    {field.subfields.map((sf, si) => {
                      const sfLabel = tagDef?.subfields[sf.code];
                      return (
                        <div key={si} className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary-600 font-bold w-4">$</span>
                          <input type="text" maxLength={1}
                            className="w-8 text-center font-mono text-xs border border-neutral-300 rounded px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white"
                            value={sf.code} onChange={e => updateSubfield(fi, si, { code: e.target.value })}
                            placeholder="a" title="Subfield code" />
                          <input type="text"
                            className="flex-1 font-mono text-xs border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white"
                            value={sf.value} onChange={e => updateSubfield(fi, si, { value: e.target.value })}
                            placeholder={sfLabel ?? 'Subfield value'} />
                          {field.subfields.length > 1 && (
                            <button onClick={() => removeSubfield(fi, si)} className="text-neutral-300 hover:text-error-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button onClick={() => addSubfield(fi)} className="text-xs text-primary-600 hover:text-primary-800 font-medium mt-1">
                      + Add $subfield
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add field */}
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Add Field</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MARC_TAGS).map(([tag, def]) => (
                <button key={tag} onClick={() => addMarcField(tag)}
                  className="px-2.5 py-1 text-xs font-mono bg-neutral-100 hover:bg-primary-100 hover:text-primary-700 rounded transition-colors"
                  title={def.label}>
                  {tag}
                </button>
              ))}
              <button onClick={() => addMarcField()}
                className="px-3 py-1 text-xs font-mono bg-neutral-800 text-green-400 hover:bg-neutral-700 rounded transition-colors">
                + Custom tag
              </button>
            </div>
          </div>

          {/* MARC raw preview */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-primary-600 hover:text-primary-800 font-medium select-none px-1">
              Preview raw MARC21 JSON ▾
            </summary>
            <div className="mt-2 bg-neutral-900 text-green-300 font-mono text-xs rounded-xl p-4 overflow-x-auto">
              <pre>{JSON.stringify(buildMarc21(), null, 2)}</pre>
            </div>
          </details>

          <div className="flex gap-3 pt-4 border-t border-neutral-100">
            <a href="/admin/catalogue" className="btn-ghost">Cancel</a>
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? <><Spinner /> Saving…</> : 'Save MARC21 Record'}
            </button>
          </div>
        </div>
      )}

      {/* ── Z39.50 MODAL ─────────────────────────────────────────────────────── */}
      {z3950Open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200">
              <div>
                <h2 className="font-semibold text-neutral-800">Z39.50 Copy Cataloguing</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Import bibliographic data from external library systems</p>
              </div>
              <button onClick={() => setZ3950Open(false)} className="text-neutral-400 hover:text-neutral-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {Z3950_SOURCES.map(s => (
                  <button key={s.id} onClick={() => setZ3950Source(s.id)}
                    className={`border rounded-lg p-3 text-left text-sm transition-all ${z3950Source === s.id ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-neutral-200 hover:border-primary-200'}`}>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-neutral-400 mt-0.5">{s.url.split('/')[2]}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input type="text" className="input flex-1" value={z3950Query} onChange={e => setZ3950Query(e.target.value)}
                  placeholder="Enter ISBN, title, or author…"
                  onKeyDown={e => e.key === 'Enter' && z3950Search()} />
                <button onClick={z3950Search} disabled={z3950Searching || !z3950Query.trim()} className="btn-primary disabled:opacity-50">
                  {z3950Searching ? <Spinner /> : 'Search'}
                </button>
              </div>

              {z3950Results.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {z3950Results.map((r, i) => (
                    <div key={i} className="border border-neutral-200 rounded-xl p-3 hover:border-primary-300 hover:bg-primary-50 transition-all">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-neutral-800 line-clamp-1">{r.title}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {r.authors?.map((a: any) => a.name ?? a).join(', ')}
                            {r.publish_date && ` · ${r.publish_date}`}
                            {r.publishers?.[0]?.name && ` · ${r.publishers[0].name}`}
                          </p>
                          {r._isbn && <p className="text-xs font-mono text-neutral-400 mt-0.5">ISBN: {r._isbn}</p>}
                        </div>
                        <button onClick={() => importZ3950Record(r)} className="btn-primary text-xs px-3 py-1.5 shrink-0">
                          Import
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {z3950Searching && (
                <div className="flex items-center justify-center py-6 gap-2 text-neutral-400 text-sm">
                  <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  Searching {Z3950_SOURCES.find(s => s.id === z3950Source)?.label}…
                </div>
              )}

              {!z3950Searching && z3950Results.length === 0 && z3950Query && (
                <p className="text-sm text-neutral-400 text-center py-4">No records found. Try a different query or source.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  return <div className={`${small ? 'w-3 h-3' : 'w-4 h-4'} border-2 border-current border-t-transparent rounded-full animate-spin inline-block`} />;
}
