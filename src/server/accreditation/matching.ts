import {
  accreditationProgrammes,
  programmeSubjectLabels,
  type AccreditationProgramme,
} from '@/data/accreditation/programmes';

export const SCORE_TITLE_MATCH = 2;
export const SCORE_SUBJECT_MATCH = 1.5;
export const SCORE_CURRICULUM_KEYWORD = 1;
export const SCORE_ABSTRACT_KEYWORD = 0.5;
export const PROGRAMME_MATCH_THRESHOLD = 1;

export interface ScorableRecord {
  title: string;
  subjectHeadings: string[];
  abstractText?: string | null;
}

export interface MatchOutcome {
  score: number;
  matchedTerms: string[];
}

const normalise = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

export const containsPhrase = (haystack: string, phrase: string): boolean =>
  haystack.includes(` ${phrase} `) ||
  haystack.startsWith(`${phrase} `) ||
  haystack.endsWith(` ${phrase}`) ||
  haystack === phrase;

export const scoreRecordForProgramme = (
  record: ScorableRecord,
  programme: AccreditationProgramme,
): MatchOutcome => {
  const title = normalise(record.title);
  const subjects = normalise(record.subjectHeadings.join(' | '));
  const abstract = normalise(record.abstractText ?? '');
  const matchedTerms: string[] = [];
  let score = 0;

  const nameTerms = [normalise(programme.name), ...programme.searchTerms.map(normalise)];
  const titleHit = nameTerms.some((term) => term.length >= 4 && containsPhrase(title, term));
  if (titleHit) {
    score += SCORE_TITLE_MATCH;
    matchedTerms.push(programme.name);
  }

  const subjectLabels = programmeSubjectLabels(programme).map(normalise);
  const subjectHit = subjectLabels.filter((label) => label.length >= 5 && containsPhrase(subjects, label));
  if (subjectHit.length > 0) {
    score += SCORE_SUBJECT_MATCH;
    matchedTerms.push(...subjectHit.slice(0, 3));
  }

  const curriculumHits = programme.curriculumTopics.filter(
    (topic) => topic.length >= 5 && (containsPhrase(title, topic) || containsPhrase(subjects, topic)),
  );
  if (curriculumHits.length > 0) {
    score += SCORE_CURRICULUM_KEYWORD;
    matchedTerms.push(...curriculumHits.slice(0, 3));
  }

  const abstractHits =
    abstract.length > 0
      ? programme.curriculumTopics.filter((topic) => topic.length >= 5 && containsPhrase(abstract, topic))
      : [];
  if (abstractHits.length > 0) {
    score += SCORE_ABSTRACT_KEYWORD;
    matchedTerms.push(...abstractHits.slice(0, 3));
  }

  return { score: Math.round(score * 100) / 100, matchedTerms: [...new Set(matchedTerms)] };
};

export const assignProgrammes = (
  record: ScorableRecord,
): { programmes: string[]; matchedTerms: string[]; relevanceScore: number } => {
  const programmes: string[] = [];
  const matchedTerms = new Set<string>();
  let best = 0;
  for (const programme of accreditationProgrammes) {
    const outcome = scoreRecordForProgramme(record, programme);
    if (outcome.score >= PROGRAMME_MATCH_THRESHOLD) {
      programmes.push(programme.slug);
      for (const term of outcome.matchedTerms) matchedTerms.add(term);
      if (outcome.score > best) best = outcome.score;
    }
  }
  return { programmes, matchedTerms: [...matchedTerms], relevanceScore: best };
};
