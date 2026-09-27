import { describe, it, expect } from 'vitest';
import { generateSwordServiceDocument, generateSwordServiceXml } from '@/server/interoperability/sword';

describe('sword', () => {
  it('generates SWORD service document', () => {
    const doc = generateSwordServiceDocument('https://example.com');
    expect(doc.version).toBe('3.0');
    expect(doc.collection).toHaveLength(1);
    expect(doc.collection[0].title).toContain('ESUT');
  });

  it('generates valid SWORD service XML', () => {
    const xml = generateSwordServiceXml('https://example.com');
    expect(xml).toContain('<service');
    expect(xml).toContain('sword:version');
    expect(xml).toContain('<collection');
  });

  it('SWORD service document has accept types', () => {
    const doc = generateSwordServiceDocument('https://example.com');
    expect(doc.collection[0].accept).toContain('application/pdf');
    expect(doc.collection[0].acceptPackaging).toContain('http://purl.org/net/sword/package/SimpleZip');
  });
});
