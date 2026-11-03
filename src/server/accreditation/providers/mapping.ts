import { normalizeDoi, normalizeIdentifier } from '@/server/resources/normalize';
import type { AccreditationResourceType, AccessState, HarvestedItem } from '../types';

export function textValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function firstText(value: unknown): string | null {
  if (Array.isArray(value)) return textValue(value[0]);
  return textValue(value);
}

export function compactTextArray(value: unknown, cap = 12): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const text = textValue(entry);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= cap) break;
  }
  return out;
}

export function yearFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1400 && value <= 2100) return value;
  const text = textValue(value);
  if (!text) return null;
  const match = text.match(/(14|15|16|17|18|19|20)\d{2}/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return parsed >= 1400 && parsed <= 2100 ? parsed : null;
}

export function yearFromIsoDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^\s*(\d{4})/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return parsed >= 1400 && parsed <= 2100 ? parsed : null;
}

export function doiFromValue(value: unknown): string | null {
  const text = textValue(value);
  if (!text) return null;
  return normalizeDoi(text);
}

export function identifierFromValue(value: unknown): string | null {
  const text = textValue(value);
  if (!text) return null;
  return normalizeIdentifier(text);
}

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function httpUrl(value: string | null | undefined): string | null {
  const text = value?.trim() ?? null;
  return text && isHttpUrl(text) ? text : null;
}

interface ResolveAccessInput {
  fullTextUrl?: string | null;
  abstractText?: string | null;
  openAccess?: boolean;
  unknownIsOpenAccess?: boolean;
}

function resolveAccess(input: ResolveAccessInput): { accessState: AccessState; openAccess: boolean } {
  const hasFullText = Boolean(input.fullTextUrl && input.fullTextUrl.trim());
  const hasAbstract = Boolean(input.abstractText && input.abstractText.trim());
  const accessState: AccessState = hasFullText ? 'full_text' : hasAbstract ? 'abstract_only' : 'metadata_only';
  const openAccess = input.openAccess ?? input.unknownIsOpenAccess ?? hasFullText;
  return { accessState, openAccess };
}

export function mapResearchType(providerType: unknown): AccreditationResourceType {
  const value = textValue(providerType)?.toLowerCase() ?? '';
  if (/preprint/.test(value)) return 'research_article';
  if (/dataset/.test(value)) return 'dataset';
  if (/thesis|dissertation/.test(value)) return 'thesis';
  if (/standard|patent/.test(value)) return 'standard';
  if (/book|chapter/.test(value)) return 'ebook';
  if (/report|working paper|technical report/.test(value)) return 'report';
  if (/journal|serial/.test(value)) return 'ejournal';
  return 'research_article';
}

interface HarvestedItemInput {
  externalId: string;
  resourceType: AccreditationResourceType;
  title: string;
  creators: string[];
  landingPageUrl: string;
  publisher?: string | null;
  publicationDate?: string | null;
  publicationYear?: number | null;
  doi?: string | null;
  isbn?: string | null;
  issn?: string | null;
  language?: string | null;
  subjectHeadings?: string[];
  abstractText?: string | null;
  fullTextUrl?: string | null;
  openAccess?: boolean;
  unknownIsOpenAccess?: boolean;
}

export function resolveHarvestedItem(input: HarvestedItemInput): HarvestedItem {
  const clean = (value: string | null | undefined): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    return text ? text : undefined;
  };
  const access = resolveAccess({
    fullTextUrl: input.fullTextUrl,
    abstractText: input.abstractText,
    openAccess: input.openAccess,
    unknownIsOpenAccess: input.unknownIsOpenAccess,
  });
  return {
    externalId: input.externalId,
    resourceType: input.resourceType,
    title: input.title,
    creators: input.creators,
    publisher: clean(input.publisher),
    publicationDate: clean(input.publicationDate),
    publicationYear: input.publicationYear ?? undefined,
    doi: clean(input.doi),
    isbn: clean(input.isbn),
    issn: clean(input.issn),
    language: clean(input.language),
    subjectHeadings: input.subjectHeadings ?? [],
    abstractText: clean(input.abstractText),
    landingPageUrl: input.landingPageUrl,
    fullTextUrl: clean(input.fullTextUrl),
    accessState: access.accessState,
    openAccess: access.openAccess,
  };
}

export function withinYearRange(item: HarvestedItem, yearFrom: number, yearTo: number): boolean {
  const year = item.publicationYear;
  if (year === undefined || year === null) return false;
  return year >= yearFrom && year <= yearTo;
}