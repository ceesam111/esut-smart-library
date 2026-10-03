import { describe, it, expect } from 'vitest';
import { parseMarcXml, serializeMarcXml } from './marcXmlParser';

describe('MARCXML round-trip', () => {
  it('preserves unknown fields, 9xx fields, repeated fields, indicators, subfields', () => {
    const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">
<record>
  <leader>02392nkd a22004455a 4500</leader>
  <controlfield tag="001">19438698</controlfield>
  <controlfield tag="003">DLC</controlfield>
  <datafield tag="020" ind1=" " ind2=" ">
    <subfield code="a">978-0-13-468599-1</subfield>
  </datafield>
  <datafield tag="100" ind1="1" ind2=" ">
    <subfield code="a">Bailey, Charles P.</subfield>
    <subfield code="d">1910-</subfield>
  </datafield>
  <datafield tag="245" ind1="1" ind2="0">
    <subfield code="a">Surgery of the heart</subfield>
    <subfield code="c">Charles P. Bailey</subfield>
  </datafield>
  <datafield tag="260" ind1=" " ind2=" ">
    <subfield code="a">Philadelphia</subfield>
    <subfield code="b">Lea &amp; Febiger</subfield>
    <subfield code="c">1955</subfield>
  </datafield>
  <datafield tag="650" ind1=" " ind2="0">
    <subfield code="a">Heart</subfield>
    <subfield code="x">Surgery</subfield>
  </datafield>
  <datafield tag="650" ind1=" " ind2="0">
    <subfield code="a">Surgery</subfield>
  </datafield>
  <datafield tag="700" ind1="1" ind2=" ">
    <subfield code="a">Smith, John</subfield>
  </datafield>
  <datafield tag="999" ind1=" " ind2=" ">
    <subfield code="a">Local holdings data</subfield>
  </datafield>
  <datafield tag="980" ind1=" " ind2=" ">
    <subfield code="a">Institution specific</subfield>
  </datafield>
</record>
</collection>`;

    const record = parseMarcXml(originalXml);

    expect(record.leader).toBe('02392nkd a22004455a 4500');
    expect(record.fields).toHaveLength(11);

    const tag001 = record.fields.find(f => f.tag === '001');
    expect(tag001?.value).toBe('19438698');

    const tag245 = record.fields.find(f => f.tag === '245');
    expect(tag245?.ind1).toBe('1');
    expect(tag245?.ind2).toBe('0');
    expect(tag245?.subfields).toHaveLength(2);
    expect(tag245?.subfields?.[0]).toEqual({ code: 'a', value: 'Surgery of the heart' });
    expect(tag245?.subfields?.[1]).toEqual({ code: 'c', value: 'Charles P. Bailey' });

    const tag650s = record.fields.filter(f => f.tag === '650');
    expect(tag650s).toHaveLength(2);
    expect(tag650s[0].subfields?.[0]).toEqual({ code: 'a', value: 'Heart' });
    expect(tag650s[1].subfields?.[0]).toEqual({ code: 'a', value: 'Surgery' });

    const tag999 = record.fields.find(f => f.tag === '999');
    expect(tag999).toBeDefined();
    expect(tag999?.subfields?.[0]?.value).toBe('Local holdings data');

    const tag980 = record.fields.find(f => f.tag === '980');
    expect(tag980).toBeDefined();

    tag245!.subfields![0].value = 'Surgery of the heart, 2nd ed.';

    const modifiedXml = serializeMarcXml(record);
    const reparsed = parseMarcXml(modifiedXml);

    expect(reparsed.fields).toHaveLength(11);

    const reTag245 = reparsed.fields.find(f => f.tag === '245');
    expect(reTag245?.subfields?.[0]?.value).toBe('Surgery of the heart, 2nd ed.');

    const reTag650s = reparsed.fields.filter(f => f.tag === '650');
    expect(reTag650s).toHaveLength(2);
    expect(reTag650s[0].subfields?.[0]?.value).toBe('Heart');
    expect(reTag650s[1].subfields?.[0]?.value).toBe('Surgery');

    const reTag999 = reparsed.fields.find(f => f.tag === '999');
    expect(reTag999?.subfields?.[0]?.value).toBe('Local holdings data');

    const reTag980 = reparsed.fields.find(f => f.tag === '980');
    expect(reTag980?.subfields?.[0]?.value).toBe('Institution specific');

    const reTag100 = reparsed.fields.find(f => f.tag === '100');
    expect(reTag100?.ind1).toBe('1');
    expect(reTag100?.subfields).toHaveLength(2);
    expect(reTag100?.subfields?.[0]?.value).toBe('Bailey, Charles P.');
    expect(reTag100?.subfields?.[1]?.value).toBe('1910-');

    const reTag260 = reparsed.fields.find(f => f.tag === '260');
    expect(reTag260?.subfields).toHaveLength(3);
    expect(reTag260?.subfields?.[0]?.value).toBe('Philadelphia');
    expect(reTag260?.subfields?.[1]?.value).toBe('Lea & Febiger');
    expect(reTag260?.subfields?.[2]?.value).toBe('1955');
  });

  it('handles empty subfields and missing indicators', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">
<record>
  <leader>00000nam a2200000 i 4500</leader>
  <datafield tag="500" ind1=" " ind2=" ">
    <subfield code="a">Note</subfield>
  </datafield>
</record>
</collection>`;

    const record = parseMarcXml(xml);
    expect(record.fields).toHaveLength(1);
    expect(record.fields[0].tag).toBe('500');
    expect(record.fields[0].subfields).toHaveLength(1);

    const out = serializeMarcXml(record);
    const reparsed = parseMarcXml(out);
    expect(reparsed.fields[0].subfields?.[0]?.value).toBe('Note');
  });
});
