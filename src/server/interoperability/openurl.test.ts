import { describe, it, expect } from 'vitest';
import { generateOpenUrl, parseOpenUrl } from '@/server/interoperability/openurl';

describe('openurl', () => {
  it('generates OpenURL with required params', () => {
    const url = generateOpenUrl({ title: 'Test Article', aulast: 'Smith', date: '2024' });
    expect(url).toContain('ctx_ver=Z39.88-2004');
    expect(url).toContain('rft.title=Test+Article');
    expect(url).toContain('rft.aulast=Smith');
    expect(url).toContain('rft.date=2024');
  });

  it('parses OpenURL params back to metadata', () => {
    const url = generateOpenUrl({ title: 'Test', volume: '10', issue: '2' });
    const metadata = parseOpenUrl(url);
    expect(metadata.title).toBe('Test');
    expect(metadata.volume).toBe('10');
    expect(metadata.issue).toBe('2');
  });

  it('generates OpenURL with DOI', () => {
    const url = generateOpenUrl({ doi: '10.1234/test' });
    expect(url).toContain('rft.doi=10.1234');
  });
});
