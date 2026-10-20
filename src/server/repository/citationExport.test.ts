import { describe, expect, it } from 'vitest';
import { toBibtex, toRis, type CitationInput } from './citationExport';

const item: CitationInput = {
  id: 'abc-123',
  handle: 'esutir/2026/deadbeef',
  title: 'Renewable Energy Adoption in Enugu',
  authors: [{ name: 'Okonkwo, Chidi A.' }, { name: 'Abubakar, Halima' }],
  abstract: 'A study of solar adoption.',
  keywords: ['solar', 'energy', 'Enugu'],
  type: 'Article',
  item_type: 'journal',
  doi: '10.1234/esut.2026.001',
  year: 2026,
  language: 'English',
  created_at: '2026-03-01T10:00:00Z',
  department: 'Physics',
  faculty_code: 'FSC',
};

describe('toBibtex', () => {
  it('produces a parseable @article entry with author and url', () => {
    const bib = toBibtex(item);
    expect(bib.startsWith('@article{')).toBe(true);
    expect(bib).toContain('title = {Renewable Energy Adoption in Enugu}');
    expect(bib).toContain('author = {Okonkwo, Chidi A. and Abubakar, Halima}');
    expect(bib).toContain('year = {2026}');
    expect(bib).toContain('doi = {10.1234/esut.2026.001}');
    expect(bib).toContain('/repository/abc-123');
    expect(bib).toContain('keywords = {solar, energy, Enugu}');
    expect(bib.trim().endsWith('}')).toBe(true);
  });

  it('maps thesis type to phdthesis and handles missing fields', () => {
    const bib = toBibtex({ ...item, item_type: 'thesis', doi: null, abstract: null, year: null, created_at: '2025-01-01T00:00:00Z' });
    expect(bib.startsWith('@phdthesis{')).toBe(true);
    expect(bib).not.toContain('doi =');
    expect(bib).not.toContain('abstract =');
    expect(bib).toContain('year = {2025}');
  });
});

describe('toRis', () => {
  it('produces RIS with TY, AU, TI, DO, UR and ER tags', () => {
    const ris = toRis(item);
    expect(ris).toContain('TY  - JOUR');
    expect(ris).toContain('AU  - Okonkwo, Chidi A.');
    expect(ris).toContain('AU  - Abubakar, Halima');
    expect(ris).toContain('TI  - Renewable Energy Adoption in Enugu');
    expect(ris).toContain('PY  - 2026');
    expect(ris).toContain('DO  - 10.1234/esut.2026.001');
    expect(ris).toContain('UR  - ');
    expect(ris).toMatch(/ER\s+-\s*$/);
  });

  it('maps thesis type to THES', () => {
    const ris = toRis({ ...item, item_type: 'dissertation' });
    expect(ris).toContain('TY  - THES');
  });

  it('neutralizes newline citation injection in titles and abstracts', () => {
    const injected: CitationInput = {
      ...item,
      title: 'Clean Title\nAU  - Forged Author',
      abstract: 'Line one\r\nER  - \nKW  - injected',
    };
    const bib = toBibtex(injected);
    expect(bib).toContain('title = {Clean Title AU  - Forged Author}');
    expect(bib.split('\n').some((line) => /^\s*AU\s*-/.test(line))).toBe(false);

    const ris = toRis(injected);
    const lines = ris.split('\r\n');
    expect(lines).toContain('TI  - Clean Title AU  - Forged Author');
    expect(lines.filter((line) => line.startsWith('ER'))).toEqual(['ER  - ']);
    expect(lines.filter((line) => line.startsWith('KW'))).toEqual(['KW  - solar', 'KW  - energy', 'KW  - Enugu']);
  });
});
