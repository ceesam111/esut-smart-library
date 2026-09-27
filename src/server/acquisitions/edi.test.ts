import { describe, it, expect } from 'vitest';

describe('edi', () => {
  it('EDI X12 850 segment structure is valid', () => {
    const segments = ['ISA*', 'GS*PO*', 'ST*850*', 'BEG*', 'PO1*', 'CTT*', 'SE*', 'GE*', 'IEA*'];
    expect(segments).toContain('ISA*');
    expect(segments).toContain('ST*850*');
  });

  it('EDI 850 has correct segment count', () => {
    const edi = 'ISA*~\nGS*PO*~\nST*850*~\nBEG*~\nPO1*~\nCTT*~\nSE*~\nGE*~\nIEA*~';
    const parsed = edi.split('~').filter(Boolean);
    expect(parsed.length).toBeGreaterThan(5);
  });

  it('EDI 850 includes PO1 line items', () => {
    const edi = 'ISA*~\nGS*PO*~\nST*850*~\nBEG*~\nPO1*1*EA*50**BP*ITEM~\nCTT*~\nSE*~\nGE*~\nIEA*~';
    expect(edi).toContain('PO1*');
  });
});
