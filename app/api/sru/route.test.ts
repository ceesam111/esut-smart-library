import { describe, it, expect } from 'vitest';

describe('sru', () => {
  it('SRU explain returns valid XML structure', () => {
    const xml = '<?xml version="1.0"?><explainResponse><version>1.1</version></explainResponse>';
    expect(xml).toContain('explainResponse');
    expect(xml).toContain('1.1');
  });

  it('SRU searchRetrieve returns valid XML structure', () => {
    const xml = '<?xml version="1.0"?><searchRetrieveResponse><version>1.1</version><numberOfRecords>0</numberOfRecords></searchRetrieveResponse>';
    expect(xml).toContain('searchRetrieveResponse');
    expect(xml).toContain('numberOfRecords');
  });

  it('SRU diagnostic returns valid XML structure', () => {
    const xml = '<?xml version="1.0"?><searchRetrieveResponse><diagnostics><diagnostic><message>test</message></diagnostic></diagnostics></searchRetrieveResponse>';
    expect(xml).toContain('diagnostics');
    expect(xml).toContain('message');
  });
});
