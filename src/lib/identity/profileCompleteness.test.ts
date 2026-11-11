import { describe, expect, it } from 'vitest';
import { completenessFields, profileCompleteness, type CompletenessProfile } from './profileCompleteness';

const emptyProfile: CompletenessProfile = {};

const fullProfile: CompletenessProfile = {
  academic_rank: 'Senior Lecturer',
  department: 'Computer Science',
  institutional_email: 'c.okafor@esut.edu.ng',
  biography: 'Researcher in distributed systems with fifteen years of teaching experience.',
  orcid_id: '0000-0002-1825-0097',
  profile_photo_url: 'https://cdn.example.edu.ng/photo.jpg',
  research_keywords: ['distributed systems', 'education'],
  highest_qualification: { degree: 'PhD', institution: 'University of Nigeria' },
};

describe('completenessFields', () => {
  it('weights add up to 100', () => {
    const total = completenessFields(fullProfile).reduce((sum, field) => sum + field.weight, 0);
    expect(total).toBe(100);
  });

  it('marks every field missing on an empty profile', () => {
    const fields = completenessFields(emptyProfile);
    expect(fields).toHaveLength(8);
    expect(fields.every((field) => field.met === false)).toBe(true);
  });

  it('marks every field present on a complete profile', () => {
    const fields = completenessFields(fullProfile);
    expect(fields.every((field) => field.met === true)).toBe(true);
  });
});

describe('profileCompleteness', () => {
  it('scores an empty profile as 0 with all keys missing', () => {
    const result = profileCompleteness(emptyProfile);
    expect(result.score).toBe(0);
    expect(result.totalWeight).toBe(100);
    expect(result.missing).toEqual([
      'academic_rank',
      'department',
      'institutional_email',
      'biography',
      'orcid',
      'profile_photo',
      'research_keywords',
      'qualifications',
    ]);
  });

  it('scores a complete profile as 100 with nothing missing', () => {
    const result = profileCompleteness(fullProfile);
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it('does not award ORCID points for a checksum-invalid value', () => {
    const result = profileCompleteness({ ...fullProfile, orcid_id: '0000-0002-1825-0094' });
    expect(result.score).toBe(80);
    expect(result.missing).toEqual(['orcid']);
  });

  it('treats whitespace-only keyword entries as missing', () => {
    const result = profileCompleteness({ ...fullProfile, research_keywords: ['  ', ''] });
    expect(result.missing).toEqual(['research_keywords']);
  });

  it('accepts object qualifications but rejects empty objects', () => {
    expect(profileCompleteness({ ...fullProfile, highest_qualification: {} }).missing).toEqual(['qualifications']);
    expect(profileCompleteness({ ...fullProfile, highest_qualification: { degree: 'MSc' } }).missing).toEqual([]);
  });
});
