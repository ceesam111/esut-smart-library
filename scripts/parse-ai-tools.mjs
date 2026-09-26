#!/usr/bin/env node
/**
 * Parses university_library_open_access_ai_tools_directory.md into
 * src/config/aiTools.data.ts (typed AITool records for the AI Tools page).
 *
 * Usage: node scripts/parse-ai-tools.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mdPath = join(root, 'university_library_open_access_ai_tools_directory.md');
const outPath = join(root, 'src', 'config', 'aiTools.data.ts');

const text = readFileSync(mdPath, 'utf8');
const lines = text.split(/\r?\n/);

const START = lines.findIndex((l) => l.trim() === '# Detailed records');
const STOP_CANDIDATES = ['## Filters', '# Governance checklist before deployment', '# High-value native integrations'];
let STOP = lines.length;
for (const marker of STOP_CANDIDATES) {
  const idx = lines.findIndex((l, i) => i > START && l.startsWith(marker));
  if (idx !== -1 && idx < STOP) STOP = idx;
}

const MENU_GROUPS = {
  'Scholarly Search & Discovery': ['Scholarly Search & Discovery', 'Scholarly & Patent Discovery'],
  'Literature Mapping & Discovery': ['Literature Mapping & Discovery'],
  'Scholarly Search & Evidence Synthesis': ['Scholarly Search & Evidence Synthesis'],
  'Systematic Review & Evidence Screening': ['Systematic Review & Evidence Screening'],
  'Research Reading, PDF & Source-Grounded AI': [
    'Research Reading & Writing',
    'Research Reading & Summarisation',
    'Research Reading & Comprehension',
    'Document Q&A',
    'Source-Grounded Research Workspace',
  ],
  'Academic Writing, Editing & Translation': [
    'Academic Writing & Editing',
    'Writing, Paraphrasing & Summarisation',
    'Grammar & Language Editing',
    'Language Editing & Translation',
  ],
  'General-Purpose AI & AI Search': ['General-Purpose AI Assistant', 'AI Search & Web Research'],
  'Library Metadata, Cataloguing & Subject Indexing': [
    'Library Metadata, Classification & Subject Indexing',
    'Scholarly Document Parsing & Metadata Extraction',
  ],
  'Open Scholarly Infrastructure & OA Resolution': [
    'Open Scholarly Infrastructure',
    'Open Access Discovery & Infrastructure',
    'Open Access Resolution',
  ],
  'Digitisation, OCR, Speech & Accessibility': [
    'Digitisation, OCR & Accessibility',
    'Digitisation, Handwriting & OCR',
    'Speech-to-Text & Accessibility',
  ],
  'Private / Local AI Infrastructure': ['Private / Local AI Infrastructure'],
  'Data Science, Machine Learning & AI Development': [
    'Data Science, Machine Learning & GenAI',
    'Data Science & Machine Learning',
    'AI Development & Prototyping',
    'Open AI Model & App Discovery',
  ],
};

function groupFor(category) {
  for (const [group, cats] of Object.entries(MENU_GROUPS)) {
    if (cats.includes(category)) return group;
  }
  return category;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function field(block, label) {
  const re = new RegExp(`^\\s*-\\s*\\*\\*${label}:\\*\\*\\s*(.*)$`, 'i');
  for (const line of block) {
    const m = line.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

function splitAudiences(raw) {
  return raw
    .split(/[;•]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAccess(raw) {
  // e.g. "**OA-1 / Free core service**" or "OA-1/4 / OA corpus + API"
  const cleaned = raw.replace(/\*\*/g, '').trim();
  const [codePart = '', labelPart = ''] = cleaned.split(' / ');
  const badges = [];
  if (/OA-1/i.test(codePart)) badges.push('Open Source / Open Data');
  if (/OA-2/i.test(codePart)) badges.push('Free Service');
  if (/OA-3/i.test(codePart)) badges.push('Freemium');
  if (/OA-4/i.test(codePart)) badges.push('Free Developer Tier');
  if (/Conditional/i.test(codePart)) badges.push('Conditional');
  if (!badges.length) badges.push('See details');
  return { code: cleaned, label: labelPart.trim() || cleaned, badges };
}

function privacyFor(tool) {
  const hay = `${tool.integration} ${tool.description} ${tool.name}`.toLowerCase();
  if (/self-host|local |on-premise|desktop|open source runtime|locally/.test(hay)) return 'Local / self-hostable';
  if (/institution-managed|institution-hosted/.test(hay)) return 'Institution-managed';
  return 'Cloud service';
}

function integrationTypes(raw) {
  const hay = raw.toLowerCase();
  const types = [];
  if (/link-out|link only/.test(hay)) types.push('External link');
  if (/api|rest/.test(hay)) types.push('API');
  if (/self-host/.test(hay)) types.push('Self-host');
  if (/desktop/.test(hay)) types.push('Desktop');
  if (/mcp/.test(hay)) types.push('MCP');
  if (!types.length) types.push('External link');
  return types;
}

// ── Parse blocks ────────────────────────────────────────────────────────────────
const blocks = [];
let current = null;
for (let i = START; i < STOP; i += 1) {
  const line = lines[i];
  const h = line.match(/^(##|###)\s+(.*)$/);
  if (h) {
    if (current) blocks.push(current);
    current = { level: h[1].length, title: h[2].trim(), start: i, lines: [] };
  } else if (current) {
    current.lines.push(line);
  }
}
if (current) blocks.push(current);

const tools = [];
const skipped = [];
let category = '';

for (const block of blocks) {
  const isTool = field(block.lines, 'Description').length > 0;
  if (!isTool) {
    if (block.level === 2) category = block.title;
    continue;
  }

  const name = block.title;
  const description = field(block.lines, 'Description');
  const audiences = splitAudiences(field(block.lines, 'Primary audience'));
  const homepage = field(block.lines, 'Homepage').replace(/^<|>$/g, '');
  const imageUrl = field(block.lines, 'Prototype image/icon URL');
  const accessText = field(block.lines, 'Access');
  const accessRaw = field(block.lines, 'Access classification');
  const integration = field(block.lines, 'Integration recommendation');
  const caution = field(block.lines, 'Library caution');
  const verificationSource = field(block.lines, 'Verification source');
  const lastVerified = field(block.lines, 'Last verified');
  const tagsRaw = field(block.lines, 'Suggested app tags');

  if (!homepage || !description) {
    skipped.push(name);
    continue;
  }

  const access = parseAccess(accessRaw || accessText);
  const accountRequired = !/no login|without a login|no account|no sign-?up|without login/i.test(
    `${accessText} ${description}`,
  );

  tools.push({
    id: slugify(name),
    name,
    category: category || 'Other',
    group: groupFor(category || 'Other'),
    description,
    audiences,
    homepageUrl: homepage,
    imageUrl:
      imageUrl ||
      `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(homepage)}`,
    accessCode: access.code,
    accessLabel: access.label,
    accessBadges: access.badges,
    accessText,
    accountRequired,
    integration,
    integrationTypes: integrationTypes(integration),
    privacy: '',
    caution,
    verificationSource,
    lastVerified,
    tags: tagsRaw
      .split(',')
      .map((t) => t.replace(/[`"]/g, '').trim())
      .filter(Boolean),
  });
}

for (const tool of tools) tool.privacy = privacyFor(tool);

// stable ordering: group order from menu architecture, then category, then name
const GROUP_ORDER = Object.keys(MENU_GROUPS);
tools.sort((a, b) => {
  const ga = GROUP_ORDER.indexOf(a.group);
  const gb = GROUP_ORDER.indexOf(b.group);
  if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.name.localeCompare(b.name);
});

const groups = GROUP_ORDER.filter((g) => tools.some((t) => t.group === g));
const categories = [...new Set(tools.map((t) => t.category))];
const audiences = [...new Set(tools.flatMap((t) => t.audiences))].sort();

if (tools.length < 40) {
  console.error(`Parsed only ${tools.length} tools — expected at least 40. Skipped: ${skipped.join(', ')}`);
  process.exit(1);
}

const ts = `/* eslint-disable */
// AUTO-GENERATED by scripts/parse-ai-tools.mjs from
// university_library_open_access_ai_tools_directory.md
// Do not edit by hand — re-run the script after updating the source markdown.

export interface AITool {
  id: string;
  name: string;
  category: string;
  group: string;
  description: string;
  audiences: string[];
  homepageUrl: string;
  imageUrl: string;
  accessCode: string;
  accessLabel: string;
  accessBadges: string[];
  accessText: string;
  accountRequired: boolean;
  integration: string;
  integrationTypes: string[];
  privacy: string;
  caution: string;
  verificationSource: string;
  lastVerified: string;
  tags: string[];
}

export const AI_TOOLS_SOURCE_DATE = '2026-09-25';

export const AI_TOOL_GROUPS: string[] = ${JSON.stringify(groups, null, 2)};

export const AI_TOOL_CATEGORIES: string[] = ${JSON.stringify(categories, null, 2)};

export const AI_TOOL_AUDIENCES: string[] = ${JSON.stringify(audiences, null, 2)};

export const AI_TOOLS: AITool[] = ${JSON.stringify(tools, null, 2)};
`;

writeFileSync(outPath, ts, 'utf8');
console.log(`Wrote ${tools.length} tools -> ${outPath}`);
console.log(`Groups: ${groups.length}, Categories: ${categories.length}, Audiences: ${audiences.length}`);
if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`);
