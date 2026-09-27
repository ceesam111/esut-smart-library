import { describe, it, expect } from 'vitest';
import { generateKbart } from '@/server/interoperability/kbart';

describe('kbart', () => {
  it('generates KBART with header row', () => {
    const kbart = generateKbart([]);
    expect(kbart).toContain('publication_title');
    expect(kbart).toContain('print_identifier');
    expect(kbart).toContain('online_identifier');
  });

  it('generates KBART with serial data', () => {
    const serials = [
      { title: 'Test Journal', print_issn: '1234-5678', publisher: 'Test Publisher' },
    ];
    const kbart = generateKbart(serials);
    const lines = kbart.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Test Journal');
    expect(lines[1]).toContain('1234-5678');
  });

  it('handles empty optional fields', () => {
    const serials = [{ title: 'Minimal' }];
    const kbart = generateKbart(serials);
    expect(kbart).toContain('Minimal');
  });
});
