import JSZip from 'jszip';

export interface XlsxOptions {
  /** Workbook/sheet name; falls back to "Report". */
  reportName?: string;
  /** Optional header labels; defaults to column field names. */
  columnLabels?: string[];
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const CONTENT_TYPES = `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const ROOT_RELS = `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const STYLES = `${XML_DECL}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const HEADER_STYLE = 1;
const DATE_STYLE = 2;

function escapeXml(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Neutralizes spreadsheet formula injection for plain-string cells. */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function colLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return cleaned || 'Report';
}

/** Excel date serial (days since 1899-12-30), with fraction for datetimes. */
function toExcelSerial(date: Date): number | null {
  const ms = date.getTime();
  if (Number.isNaN(ms)) return null;
  const epoch = Date.UTC(1899, 11, 30);
  return (ms - epoch) / 86_400_000;
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
}

function cellXml(ref: string, value: unknown, extraStyle?: number): string {
  if (value === null || value === undefined || value === '') {
    return extraStyle ? `<c r="${ref}" s="${extraStyle}"/>` : `<c r="${ref}"/>`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const style = extraStyle ? ` s="${extraStyle}"` : '';
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }

  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  const date = parseDateValue(value);
  if (date) {
    const serial = toExcelSerial(date);
    if (serial !== null) {
      return `<c r="${ref}" s="${DATE_STYLE}"><v>${serial}</v></c>`;
    }
  }

  const text = neutralizeFormula(typeof value === 'string' ? value : String(value));
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetXml(headers: string[], rows: unknown[][]): string {
  const parts: string[] = [`${XML_DECL}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`];

  const headerCells = headers
    .map((label, i) => {
      const ref = `${colLetter(i)}1`;
      const text = escapeXml(neutralizeFormula(label));
      return `<c r="${ref}" s="${HEADER_STYLE}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    })
    .join('');
  parts.push(`<row r="1">${headerCells}</row>`);

  rows.forEach((row, rowIndex) => {
    const r = rowIndex + 2;
    const cells = row
      .map((value, colIndex) => cellXml(`${colLetter(colIndex)}${r}`, value))
      .join('');
    parts.push(`<row r="${r}">${cells}</row>`);
  });

  parts.push('</sheetData></worksheet>');
  return parts.join('');
}

function workbookRels(): string {
  return `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function coreProps(reportName: string): string {
  const now = new Date().toISOString();
  return `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(reportName)}</dc:title><dc:creator>DWC Report Builder</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appProps(): string {
  return `${XML_DECL}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>DWC Report Builder</Application></Properties>`;
}

/**
 * Builds a genuine OOXML .xlsx workbook (ZIP package) from report rows.
 * String cells are inline strings and formula-prefixed values are neutralized,
 * so data can never execute as formulas.
 */
export async function buildXlsx(
  data: Array<Record<string, unknown>>,
  columns: string[],
  options: XlsxOptions = {},
): Promise<Buffer> {
  const reportName = options.reportName ?? 'Report';
  const headers = options.columnLabels ?? columns;
  const rows = data.map((row) => columns.map((col) => row[col]));

  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('xl/workbook.xml', `${XML_DECL}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sanitizeSheetName(reportName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', workbookRels());
  zip.file('xl/styles.xml', STYLES);
  zip.file('xl/worksheets/sheet1.xml', sheetXml(headers, rows));
  zip.file('docProps/core.xml', coreProps(reportName));
  zip.file('docProps/app.xml', appProps());

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return buffer as Buffer;
}
