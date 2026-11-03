import {
  ACCREDITATION_YEAR_FROM,
  type AccreditationProgramme,
  type ProgrammeSubjectNode,
} from '@/data/accreditation/programmes';
import type { CoverageTopic } from '@/lib/accreditationApi';
import { containsPhrase } from './matching';

export const COVERAGE_THRESHOLDS = {
  programmeMinimum: 25,
  topicMinimum: 3,
};

export interface CoverageInputRecord {
  resourceType: string;
  year: number | null;
  verified: boolean;
  hasFullText: boolean;
  title: string;
  abstract: string | null;
  subjects: string[];
}

export interface ProgrammeCoverage {
  totals: { indexed: number; recent2023: number; verified: number; fullText: number };
  byType: Array<{ type: string; count: number }>;
  topics: CoverageTopic[];
  warnings: Array<{ level: 'ok' | 'weak' | 'empty'; message: string }>;
}

const flattenSubjectNodes = (nodes: ProgrammeSubjectNode[]): ProgrammeSubjectNode[] => {
  const flattened: ProgrammeSubjectNode[] = [];
  const walk = (list: ProgrammeSubjectNode[]) => {
    for (const node of list) {
      flattened.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return flattened;
};

const haystackOf = (record: CoverageInputRecord): string =>
  [record.title, record.abstract ?? '', ...record.subjects].join(' ').toLowerCase();

const buildWarnings = (indexed: number, recent2023: number): ProgrammeCoverage['warnings'] => {
  if (indexed === 0) {
    return [
      {
        level: 'empty',
        message:
          'No records indexed for this programme yet. Trigger a sync from the accreditation evidence page.',
      },
    ];
  }
  const heuristic =
    `Internal screening heuristic (not an accreditation quota): ${recent2023} record(s) from ` +
    `${ACCREDITATION_YEAR_FROM} onwards against an internal target of ${COVERAGE_THRESHOLDS.programmeMinimum}.`;
  if (recent2023 < COVERAGE_THRESHOLDS.programmeMinimum) {
    return [{ level: 'weak', message: heuristic }];
  }
  return [{ level: 'ok', message: heuristic }];
};

export const computeProgrammeCoverage = (
  programme: AccreditationProgramme,
  records: CoverageInputRecord[],
): ProgrammeCoverage => {
  const indexed = records.length;
  const recent2023 = records.filter((record) => (record.year ?? 0) >= ACCREDITATION_YEAR_FROM).length;
  const verified = records.filter((record) => record.verified).length;
  const fullText = records.filter((record) => record.hasFullText).length;
  const typeCounts = new Map<string, number>();
  for (const record of records) {
    typeCounts.set(record.resourceType, (typeCounts.get(record.resourceType) ?? 0) + 1);
  }
  const byType = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
  const haystacks = records.map(haystackOf);
  const topics: CoverageTopic[] = flattenSubjectNodes(programme.subjects).map((node) => {
    const phrase = node.label.toLowerCase();
    const count = haystacks.filter((haystack) => containsPhrase(haystack, phrase)).length;
    return { topic: node.label, count, weak: count < COVERAGE_THRESHOLDS.topicMinimum };
  });
  return {
    totals: { indexed, recent2023, verified, fullText },
    byType,
    topics,
    warnings: buildWarnings(indexed, recent2023),
  };
};
