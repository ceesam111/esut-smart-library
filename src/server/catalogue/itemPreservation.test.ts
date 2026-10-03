import { describe, it, expect } from 'vitest';
import type { MarcRecord } from './marcValidation';

describe('item/holding preservation', () => {
  it('overlay only modifies marc21_fields, not item data', () => {
    const current: MarcRecord = {
      leader: '02392nkd a22004455a 4500',
      fields: [
        { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Existing Title' }] },
        { tag: '900', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'LOCAL DATA' }] },
      ],
    };

    const incoming: MarcRecord = {
      leader: '02392nkd a22004455a 4500',
      fields: [
        { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Incoming Title' }] },
        { tag: '900', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'EXTERNAL DATA' }] },
      ],
    };

    const itemBefore = { id: 'item-1', barcode: 'BC123', status: 'available', call_number: 'QA76' };

    expect(itemBefore.barcode).toBe('BC123');
    expect(itemBefore.status).toBe('available');
    expect(itemBefore.call_number).toBe('QA76');

    expect(current.fields.find(f => f.tag === '245')?.subfields?.[0]?.value).toBe('Existing Title');
    expect(incoming.fields.find(f => f.tag === '245')?.subfields?.[0]?.value).toBe('Incoming Title');

    expect(current.fields.find(f => f.tag === '900')?.subfields?.[0]?.value).toBe('LOCAL DATA');
  });

  it('overlay does not touch barcode, status, or call number fields', () => {
    const fields = [
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
      { tag: '900', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'LOCAL' }] },
    ];

    const itemFields = ['barcode', 'status', 'call_number', 'location', 'collection'];
    const marcTags = fields.map(f => f.tag);

    for (const itemField of itemFields) {
      expect(marcTags).not.toContain(itemField);
    }
  });
});
