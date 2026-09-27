import { describe, it, expect } from 'vitest';
import { emptyMarcRecord, marcToJsonb, jsonbToMarc, marcToXml, marcToJson, createField, addSubfield } from '@/server/catalogue/marc';

describe('marc', () => {
  it('creates empty MARC record with default leader', () => {
    const record = emptyMarcRecord();
    expect(record.leader).toBe('00000nam a2200000 a 4500');
    expect(record.fields).toEqual([]);
  });

  it('converts MARC to JSONB and back', () => {
    const record = emptyMarcRecord();
    record.fields.push(createField('245', ' ', '0', [{ code: 'a', value: 'Test Title' }]));
    const jsonb = marcToJsonb(record);
    const restored = jsonbToMarc(jsonb);
    expect(restored.leader).toBe(record.leader);
    expect(restored.fields).toHaveLength(1);
    expect(restored.fields[0].tag).toBe('245');
  });

  it('converts MARC to XML', () => {
    const record = emptyMarcRecord();
    record.fields.push(createField('245', ' ', '0', [{ code: 'a', value: 'Test Title' }]));
    const xml = marcToXml(record);
    expect(xml).toContain('<record');
    expect(xml).toContain('tag="245"');
    expect(xml).toContain('Test Title');
  });

  it('converts MARC to JSON', () => {
    const record = emptyMarcRecord();
    record.fields.push(createField('245', ' ', '0', [{ code: 'a', value: 'Test Title' }]));
    const json = marcToJson(record);
    expect(json['245']).toBeDefined();
  });

  it('adds subfields correctly', () => {
    const field = createField('245', ' ', '0', []);
    const updated = addSubfield(field, 'a', 'Title');
    expect(updated.subfields).toHaveLength(1);
    expect(updated.subfields[0].value).toBe('Title');
  });
});
