import { NextResponse } from 'next/server';

const CURRENT_YEAR = new Date().getFullYear();
const OUTDATED_BEFORE = CURRENT_YEAR - 10;

function extractJson(text: string): any {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callAI(system: string, user: string, maxTokens = 1200): Promise<any> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) throw new Error('AI service not configured');
  const baseUrl = (process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1').replace(/\/$/, '');
  const model = process.env.AI_REASONING_MODEL || process.env.AI_DEFAULT_MODEL || 'openai/gpt-4o-mini';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (res.status === 429) throw new Error('Service busy - please try again shortly.');
  if (res.status === 402) throw new Error('AI usage limit reached.');
  if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
  const data = await res.json();
  return extractJson(data.choices?.[0]?.message?.content ?? '');
}

async function analysePlagiarism(text: string) {
  const system =
    'You are an academic integrity analysis engine. Assess the provided text for likely UNORIGINAL content ' +
    '(generic boilerplate, uncited common phrasing, or text that reads as copied) and for likely AI-GENERATED content. ' +
    'You do NOT have web access, so you cannot match exact external sources. Respond ONLY with strict JSON of the form: ' +
    '{"similarity_score": <0-100 number>, "ai_content_score": <0-100 number>, "summary": "<one sentence>", ' +
    '"flagged_passages": [{"text":"<short excerpt>","reason":"<why flagged>"}], ' +
    '"matched_sources": [{"description":"<likely type/origin of similar material>","similarity":<0-100>}]}. Keep flagged_passages to at most 5.';
  const result = await callAI(system, `Analyse this text:\n\n"""${text.slice(0, 8000)}"""`, 1400);
  return {
    similarity_score: Number(result?.similarity_score ?? 0),
    ai_content_score: Number(result?.ai_content_score ?? 0),
    summary: String(result?.summary ?? ''),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    flagged_passages: Array.isArray(result?.flagged_passages) ? result.flagged_passages.slice(0, 5) : [],
    matched_sources: Array.isArray(result?.matched_sources) ? result.matched_sources.slice(0, 8) : [],
  };
}

async function analyseCitations(text: string) {
  const system =
    'You are an APA 7th edition citation checker. Validate each reference against APA 7th edition formatting rules. ' +
    'Respond ONLY with strict JSON: {"citations": [{"reference":"<the citation as given>","year":<4-digit year or null>,' +
    '"valid":<true|false>,"issues":["<formatting problem>"],"corrected":"<APA 7th corrected form or empty>"}]}. ' +
    'List every reference you can identify.';
  const result = await callAI(system, `Check these citations (APA 7th):\n\n"""${text.slice(0, 8000)}"""`, 1800);
  let outdated_count = 0;
  const citations = (Array.isArray(result?.citations) ? result.citations : []).map((c: any) => {
    const year = c?.year && Number.isFinite(Number(c.year)) ? Number(c.year) : null;
    const outdated = year !== null && year < OUTDATED_BEFORE;
    if (outdated) outdated_count += 1;
    return {
      reference: String(c?.reference ?? ''),
      year,
      valid: Boolean(c?.valid),
      issues: Array.isArray(c?.issues) ? c.issues : [],
      corrected: String(c?.corrected ?? ''),
      outdated,
    };
  });
  return { citations, citation_count: citations.length, outdated_count, currentYear: CURRENT_YEAR, outdatedBefore: OUTDATED_BEFORE };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? '');
    const text = String(body.text ?? '').trim();
    if (action === 'plagiarism') {
      if (text.length < 40) return NextResponse.json({ error: 'Please provide at least 40 characters of text.' }, { status: 400 });
      return NextResponse.json(await analysePlagiarism(text));
    }
    if (action === 'citation') {
      if (text.length < 10) return NextResponse.json({ error: 'Please paste at least one citation.' }, { status: 400 });
      return NextResponse.json(await analyseCitations(text));
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Academic Integrity check failed.' }, { status: 500 });
  }
}
