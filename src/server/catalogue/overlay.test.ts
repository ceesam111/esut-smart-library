import { describe, it, expect } from 'vitest';
import { generateOverlayPreview } from './overlay';
import type { MarcRecord } from './marcValidation';

function makeRecord(fields: MarcRecord['fields']): MarcRecord {
  return { leader: '02392nkd a22004455a 4500', fields };
}

describe('generateOverlayPreview', () => {
  const rules = [
    { id: '1', name: 'Protect 9xx', framework_id: null, tag: '9', subfield_code: null, action: 'protect' as const, is_active: true },
    { id: '2', name: 'Replace 245', framework_id: null, tag: '245', subfield_code: 'a', action: 'replace' as const, is_active: true },
    { id: '3', name: 'Append 650', framework_id: null, tag: '650', subfield_code: 'a', action: 'append' as const, is_active: true },
  ];

  it('generates replace preview for matching rule', () => {
    const current = makeRecord([{ tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Old Title' }] }]);
    const incoming = makeRecord([{ tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'New Title' }] }]);
    const previews = generateOverlayPreview(current, incoming, rules);
    expect(previews).toHaveLength(1);
    expect(previews[0].action).toBe('replace');
    expect(previews[0].currentValue).toBe('Old Title');
    expect(previews[0].incomingValue).toBe('New Title');
  });

  it('generates protect preview for protected tag', () => {
    const current = makeRecord([{ tag: '999', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'Local Data' }] }]);
    const incoming = makeRecord([{ tag: '999', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'External Data' }] }]);
    const previews = generateOverlayPreview(current, incoming, rules);
    expect(previews[0].action).toBe('protect');
  });

  it('generates append preview for append rule', () => {
    const current = makeRecord([{ tag: '650', ind1: ' ', ind2: '0', subfields: [{ code: 'a', value: 'Education' }] }]);
    const incoming = makeRecord([{ tag: '650', ind1: ' ', ind2: '0', subfields: [{ code: 'a', value: 'Nigeria' }] }]);
    const previews = generateOverlayPreview(current, incoming, rules);
    expect(previews[0].action).toBe('append');
    expect(previews[0].incomingValue).toBe('Education; Nigeria');
  });

  it('defaults to replace when no rule matches', () => {
    const current = makeRecord([{ tag: '500', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'Note' }] }]);
    const incoming = makeRecord([{ tag: '500', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'New Note' }] }]);
    const previews = generateOverlayPreview(current, incoming, rules);
    expect(previews[0].action).toBe('replace');
  });
});
