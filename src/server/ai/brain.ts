import { z } from 'zod';
import { AGENT_PROMPTS, jsonTaskPrompt } from './agentPromptTemplates';
import { safeJsonCompletion } from './safeJsonCompletion';

const baseContextSchema = z.object({ tenantId: z.string().uuid().optional(), actorUserId: z.string().uuid().nullable().optional(), skipLoggingForTests: z.boolean().optional() });
const confidenceSchema = z.enum(['low', 'medium', 'high']);

const classifyResourceSubjectsInput = baseContextSchema.extend({ resource: z.record(z.unknown()) });
const classifyResourceSubjectsOutput = z.object({ subjects: z.array(z.string()), category: z.string(), confidence: confidenceSchema, warnings: z.array(z.string()).default([]) });

export async function classifyResourceSubjects(input: z.input<typeof classifyResourceSubjectsInput>) {
  const parsed = classifyResourceSubjectsInput.parse(input);
  return safeJsonCompletion({ tenantId: parsed.tenantId, actorUserId: parsed.actorUserId, skipLoggingForTests: parsed.skipLoggingForTests, agentName: 'Hari', jobType: 'subject_classification', purpose: 'subject_classification', modelKind: 'fast', userPrompt: jsonTaskPrompt('Classify resource subjects from metadata.', '{ subjects: string[], category: string, confidence: low|medium|high, warnings: string[] }', parsed.resource), systemPrompt: AGENT_PROMPTS.Hari, schema: classifyResourceSubjectsOutput });
}

const resolveCatalogueMetadataConflictInput = baseContextSchema.extend({ provided: z.record(z.unknown()), fetched: z.record(z.unknown()) });
const resolveCatalogueMetadataConflictOutput = z.object({ preferred: z.record(z.unknown()), conflicts: z.array(z.string()), confidence: confidenceSchema, warnings: z.array(z.string()).default([]) });

export async function resolveCatalogueMetadataConflict(input: z.input<typeof resolveCatalogueMetadataConflictInput>) {
  const parsed = resolveCatalogueMetadataConflictInput.parse(input);
  return safeJsonCompletion({ tenantId: parsed.tenantId, actorUserId: parsed.actorUserId, skipLoggingForTests: parsed.skipLoggingForTests, agentName: 'Cardo', jobType: 'metadata_conflict_resolution', purpose: 'catalogue_metadata_conflict_resolution', modelKind: 'reasoning', userPrompt: jsonTaskPrompt('Resolve catalogue metadata conflicts. Do not invent missing facts.', '{ preferred: object, conflicts: string[], confidence: low|medium|high, warnings: string[] }', { provided: parsed.provided, fetched: parsed.fetched }), systemPrompt: AGENT_PROMPTS.Cardo, schema: resolveCatalogueMetadataConflictOutput });
}

const generateThesisKeywordsInput = baseContextSchema.extend({ title: z.string(), abstract: z.string() });
const generateThesisKeywordsOutput = z.object({ keywords: z.array(z.string()).max(12), confidence: confidenceSchema, warnings: z.array(z.string()).default([]) });

export async function generateThesisKeywords(input: z.input<typeof generateThesisKeywordsInput>) {
  const parsed = generateThesisKeywordsInput.parse(input);
  return safeJsonCompletion({ tenantId: parsed.tenantId, actorUserId: parsed.actorUserId, skipLoggingForTests: parsed.skipLoggingForTests, agentName: 'Thesia', jobType: 'keyword_generation', purpose: 'keyword_generation', modelKind: 'fast', userPrompt: jsonTaskPrompt('Generate thesis keywords from title and abstract.', '{ keywords: string[], confidence: low|medium|high, warnings: string[] }', { title: parsed.title, abstract: parsed.abstract }), systemPrompt: AGENT_PROMPTS.Thesia, schema: generateThesisKeywordsOutput });
}

const cleanAbstractInput = baseContextSchema.extend({ abstract: z.string().min(20) });
const cleanAbstractOutput = z.object({ cleanedAbstract: z.string(), changes: z.array(z.string()), confidence: confidenceSchema, warnings: z.array(z.string()).default([]) });

export async function cleanAbstract(input: z.input<typeof cleanAbstractInput>) {
  const parsed = cleanAbstractInput.parse(input);
  return safeJsonCompletion({ tenantId: parsed.tenantId, actorUserId: parsed.actorUserId, skipLoggingForTests: parsed.skipLoggingForTests, agentName: 'Thesia', jobType: 'abstract_cleanup', purpose: 'abstract_cleanup', modelKind: 'fast', userPrompt: jsonTaskPrompt('Clean grammar and clarity while preserving meaning.', '{ cleanedAbstract: string, changes: string[], confidence: low|medium|high, warnings: string[] }', { abstract: parsed.abstract }), systemPrompt: AGENT_PROMPTS.Thesia, schema: cleanAbstractOutput });
}

const draftNewsletterInput = baseContextSchema.extend({ audience: z.string(), topic: z.string(), facts: z.array(z.string()) });
const draftNewsletterOutput = z.object({ subject: z.string(), body: z.string(), callToAction: z.string(), confidence: confidenceSchema, warnings: z.array(z.string()).default([]) });

export async function draftNewsletter(input: z.input<typeof draftNewsletterInput>) {
  const parsed = draftNewsletterInput.parse(input);
  return safeJsonCompletion({ tenantId: parsed.tenantId, actorUserId: parsed.actorUserId, skipLoggingForTests: parsed.skipLoggingForTests, agentName: 'Penna', jobType: 'newsletter_draft', purpose: 'newsletter_draft', modelKind: 'default', userPrompt: jsonTaskPrompt('Draft a library newsletter for human review.', '{ subject: string, body: string, callToAction: string, confidence: low|medium|high, warnings: string[] }', { audience: parsed.audience, topic: parsed.topic, facts: parsed.facts }), systemPrompt: AGENT_PROMPTS.Penna, schema: draftNewsletterOutput });
}

const draftAccreditationSummaryInput = baseContextSchema.extend({ facts: z.record(z.unknown()) });
const draftAccreditationSummaryOutput = z.object({ summary: z.string(), evidenceGaps: z.array(z.string()), confidence: confidenceSchema, warnings: z.array(z.string()).default([]) });

export async function draftAccreditationSummary(input: z.input<typeof draftAccreditationSummaryInput>) {
  const parsed = draftAccreditationSummaryInput.parse(input);
  return safeJsonCompletion({ tenantId: parsed.tenantId, actorUserId: parsed.actorUserId, skipLoggingForTests: parsed.skipLoggingForTests, agentName: 'Norma', jobType: 'accreditation_report_draft', purpose: 'accreditation_report_draft', modelKind: 'reasoning', userPrompt: jsonTaskPrompt('Draft accreditation summary from supplied facts only.', '{ summary: string, evidenceGaps: string[], confidence: low|medium|high, warnings: string[] }', parsed.facts), systemPrompt: AGENT_PROMPTS.Norma, schema: draftAccreditationSummaryOutput });
}

const generateSearchExplanationInput = baseContextSchema.extend({ query: z.string(), results: z.array(z.record(z.unknown())) });
const generateSearchExplanationOutput = z.object({ explanation: z.string(), suggestedNextQueries: z.array(z.string()), confidence: confidenceSchema, warnings: z.array(z.string()).default([]) });

export async function generateSearchExplanation(input: z.input<typeof generateSearchExplanationInput>) {
  const parsed = generateSearchExplanationInput.parse(input);
  return safeJsonCompletion({ tenantId: parsed.tenantId, actorUserId: parsed.actorUserId, skipLoggingForTests: parsed.skipLoggingForTests, agentName: 'Lyria', jobType: 'search_explanation', purpose: 'search_explanation', modelKind: 'fast', userPrompt: jsonTaskPrompt('Explain search results without inventing citations.', '{ explanation: string, suggestedNextQueries: string[], confidence: low|medium|high, warnings: string[] }', { query: parsed.query, results: parsed.results }), systemPrompt: AGENT_PROMPTS.Lyria, schema: generateSearchExplanationOutput });
}

export const generateResearchRecommendation = generateSearchExplanation;
