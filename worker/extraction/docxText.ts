import JSZip from 'jszip';
import { normalize } from './pdfText';
import type { ExtractionLimits, ExtractionOutcome } from './types';

const MAX_DOCX_ENTRIES = 5000;
const MAX_DOCX_ENTRY_BYTES = 20 * 1024 * 1024;

interface ParagraphSpec {
  tag: string;
  styleTag: string;
  heading: (style: string) => boolean;
}

export async function extractDocxText(
  bytes: Buffer,
  limits: ExtractionLimits,
): Promise<ExtractionOutcome> {
  const container = await openZip(bytes, 'DOCX');
  if ('outcome' in container) return container.outcome;

  const documentEntry = container.zip.file('word/document.xml');
  if (!documentEntry) {
    return {
      status: 'FAILED',
      failureKind: 'PERMANENT_ERROR',
      errorMessage: 'DOCX has no word/document.xml part.',
      durationMs: 0,
    };
  }

  const xml = await readEntry(documentEntry, 'DOCX');
  if (typeof xml !== 'string') return xml;

  const text = normalize(
    [
      extractParagraphs(xml, {
        tag: 'w:p',
        styleTag: 'w:pStyle',
        heading: (style) => /^Heading[1-9]$/.test(style) || /^Title$/.test(style),
      }),
      extractTables(xml, 'w:tbl', 'w:tr', 'w:tc'),
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return textOutcome(text, limits);
}

export async function extractOdtText(
  bytes: Buffer,
  limits: ExtractionLimits,
): Promise<ExtractionOutcome> {
  const container = await openZip(bytes, 'ODT');
  if ('outcome' in container) return container.outcome;

  const contentEntry = container.zip.file('content.xml');
  if (!contentEntry) {
    return {
      status: 'FAILED',
      failureKind: 'PERMANENT_ERROR',
      errorMessage: 'ODT has no content.xml part.',
      durationMs: 0,
    };
  }

  const xml = await readEntry(contentEntry, 'ODT');
  if (typeof xml !== 'string') return xml;

  const text = normalize(
    [
      extractParagraphs(xml, {
        tag: 'text:h',
        styleTag: 'text:style-name',
        heading: () => true,
      }),
      extractParagraphs(xml, {
        tag: 'text:p',
        styleTag: 'text:style-name',
        heading: (style) => /^(Title|Subtitle)/.test(style),
      }),
      extractTables(xml, 'table:table', 'table:table-row', 'table:table-cell'),
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return textOutcome(text, limits);
}

function textOutcome(text: string, limits: ExtractionLimits): ExtractionOutcome {
  if (!text) {
    return { status: 'NO_TEXT_LAYER', confidence: 0, durationMs: 0 };
  }
  return {
    status: 'COMPLETE',
    text: text.slice(0, limits.maxTextChars),
    confidence: 1,
    durationMs: 0,
  };
}

async function openZip(
  bytes: Buffer,
  label: string,
): Promise<{ zip: JSZip } | { outcome: ExtractionOutcome }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch (error) {
    return {
      outcome: {
        status: 'FAILED',
        failureKind: 'PERMANENT_ERROR',
        errorMessage: `${label} is not a valid ZIP container: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: 0,
      },
    };
  }

  const names = Object.keys(zip.files);
  if (names.length > MAX_DOCX_ENTRIES) {
    return {
      outcome: {
        status: 'FAILED',
        failureKind: 'PERMANENT_ERROR',
        errorMessage: `${label} has ${names.length} entries; the limit is ${MAX_DOCX_ENTRIES}.`,
        durationMs: 0,
      },
    };
  }

  return { zip };
}

async function readEntry(
  entry: JSZip.JSZipObject,
  label: string,
): Promise<string | ExtractionOutcome> {
  let xml: string;
  try {
    xml = await entry.async('text');
  } catch (error) {
    return {
      status: 'FAILED',
      failureKind: 'PERMANENT_ERROR',
      errorMessage: `${label} body could not be read: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: 0,
    };
  }

  if (Buffer.byteLength(xml, 'utf8') > MAX_DOCX_ENTRY_BYTES) {
    return {
      status: 'FAILED',
      failureKind: 'PERMANENT_ERROR',
      errorMessage: `${label} body exceeds the maximum decompressed size.`,
      durationMs: 0,
    };
  }

  return xml;
}

function extractTables(xml: string, tableTag: string, rowTag: string, cellTag: string): string {
  const rows: string[] = [];
  const tablePattern = new RegExp(`<${tableTag}\\b[^>]*>([\\s\\S]*?)<\\/${tableTag}>`, 'g');
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(xml)) !== null) {
    const rowPattern = new RegExp(`<${rowTag}\\b[^>]*>([\\s\\S]*?)<\\/${rowTag}>`, 'g');
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowPattern.exec(tableMatch[1])) !== null) {
      const cells: string[] = [];
      const cellPattern = new RegExp(`<${cellTag}\\b[^>]*>([\\s\\S]*?)<\\/${cellTag}>`, 'g');
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
        const cellText = cellMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (cellText) cells.push(cellText);
      }
      if (cells.length > 0) rows.push(cells.join(' | '));
    }
  }

  return rows.join('\n');
}

function extractParagraphs(xml: string, spec: ParagraphSpec): string {
  const paragraphs: string[] = [];
  const paragraphPattern = new RegExp(`<${spec.tag}\\b[^>]*>([\\s\\S]*?)<\\/${spec.tag}>`, 'g');
  let match: RegExpExecArray | null;

  while ((match = paragraphPattern.exec(xml)) !== null) {
    const inner = match[1];
    const style = readStyle(inner, spec.styleTag);
    const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    paragraphs.push(spec.heading(style) ? `## ${text}` : text);
  }

  return paragraphs.join('\n');
}

function readStyle(inner: string, styleTag: string): string {
  const valued = new RegExp(`${styleTag}\\s+[^:]*:val="([^"]+)"`).exec(inner);
  if (valued) return valued[1];
  const named = new RegExp(`${styleTag}="([^"]+)"`).exec(inner);
  return named?.[1] ?? '';
}

export function docxXmlToText(xml: string): string {
  return [
    extractParagraphs(xml, {
      tag: 'w:p',
      styleTag: 'w:pStyle',
      heading: (style) => /^Heading[1-9]$/.test(style) || /^Title$/.test(style),
    }),
    extractTables(xml, 'w:tbl', 'w:tr', 'w:tc'),
  ]
    .filter(Boolean)
    .join('\n');
}

export function odtXmlToText(xml: string): string {
  return [
    extractParagraphs(xml, { tag: 'text:h', styleTag: 'text:style-name', heading: () => true }),
    extractParagraphs(xml, {
      tag: 'text:p',
      styleTag: 'text:style-name',
      heading: (style) => /^(Title|Subtitle)/.test(style),
    }),
    extractTables(xml, 'table:table', 'table:table-row', 'table:table-cell'),
  ]
    .filter(Boolean)
    .join('\n');
}
