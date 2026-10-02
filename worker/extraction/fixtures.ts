import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

export function txtFixture(): Buffer {
  return Buffer.from(
    'Renewable energy storage is critical for grid stability.\nThis thesis investigates lithium-ion battery degradation.\n',
    'utf8',
  );
}

export function csvFixture(): Buffer {
  return Buffer.from('title,year,author\nGrid Storage,2026,Adeyemi\nSolar Forecasting,2025,Okafor\n', 'utf8');
}

export function jsonFixture(): Buffer {
  return Buffer.from(
    JSON.stringify({
      title: 'A JSON dataset of library circulation records',
      description: 'Anonymised circulation transactions for 2026',
      rows: [
        { id: 1, action: 'checkout' },
        { id: 2, action: 'return' },
      ],
    }),
    'utf8',
  );
}

export function htmlFixture(): Buffer {
  return Buffer.from(
    '<html><head><title>Library Guide</title><style>body{color:red}</style></head>' +
      '<body><h1>Using the Library</h1><p>Renewable energy books are on level three.</p>' +
      '<script>ignore this</script></body></html>',
    'utf8',
  );
}

export function pdfWithTextFixture(): Buffer {
  const doc = new jsPDF();
  doc.text('Renewable Energy Storage for Grid Stability', 12, 15);
  doc.text('This thesis investigates lithium-ion battery degradation.', 12, 25);
  return Buffer.from(doc.output('arraybuffer'));
}

export function pdfWithoutTextFixture(): Buffer {
  const doc = new jsPDF();
  const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  doc.addImage(pixel, 'PNG', 10, 10, 40, 40);
  return Buffer.from(doc.output('arraybuffer'));
}

export function corruptPdfFixture(): Buffer {
  return Buffer.from('%PDF-1.4\nthis is not a real pdf body at all\n%%EOF\n', 'utf8');
}

export function unsupportedFixture(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04]);
}

export async function docxFixture(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  );

  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
  );

  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Renewable Energy Storage</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>This thesis investigates lithium-ion battery degradation.</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Year</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2026</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      '</w:body></w:document>',
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function odtFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    'content.xml',
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
      'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
      'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">' +
      '<office:body><office:text>' +
      '<text:h text:style-name="Heading_20_1">Renewable Energy Storage</text:h>' +
      '<text:p>This thesis investigates lithium-ion battery degradation.</text:p>' +
      '<table:table table:name="Meta"><table:table-row><table:table-cell><text:p>Year</text:p></table:table-cell>' +
      '<table:table-cell><text:p>2026</text:p></table:table-cell></table:table-row></table:table>' +
      '</office:text></office:body></office:document-content>',
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
