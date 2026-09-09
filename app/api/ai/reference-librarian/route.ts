import { NextResponse } from 'next/server';

function systemPrompt() {
  return `You are Lexis, ESUT Library's AI Reference Librarian. Today's date is ${new Date().toLocaleDateString('en-GB', { dateStyle: 'full' })}. Answer questions from any field of endeavour, not only library topics. Give warm, practical, full answers that help the user understand the subject, apply it, and know what to do next.

Quality rules:
- Do not be unnecessarily brief. For substantive questions, use a clear introduction, well-developed explanation, and practical conclusion.
- Use in-text citations for factual claims where appropriate, using author-date style such as (World Health Organization, 2024) or organization-date style.
- Add a "References" section at the end for substantive answers. Include credible sources such as textbooks, peer-reviewed literature, standards bodies, government/UN agencies, professional associations, or official documentation.
- Do not invent sources, titles, authors, dates, DOIs, URLs, statistics, legal provisions, or quotations. If you cannot confidently identify a real source, cite a broad credible institution only when appropriate, or say that the claim needs verification.
- Do not present uncertain, current, local, medical, legal, financial, or safety-critical information as validated fact unless it is stable and widely established. State limitations clearly and recommend checking an authoritative current source or consulting a qualified professional.
- If the user asks for something that requires real-time verification and no verified information is available in the conversation, explain what can be answered generally and what must be verified today.
- If the user asks you to play relaxation music, explain that the page can start simple in-browser relaxation tones when the user uses the music control or asks from the Calm/Wellbeing area. Do not claim to stream commercial songs.
- Prefer ESUT Smart Library features when relevant: catalogue, repository, thesis portal, open-access search, course reserves, interlibrary loan, and staff help.
- If a question is academic, include definitions, key points, examples, and study/research directions when useful.`;
}

function fallbackAnswer(messages: Array<{ role: string; content: string }>) {
  const question = messages.filter((message) => message.role === 'user').at(-1)?.content ?? '';
  return `I can help with that, but I am temporarily using a limited response mode. I should not present detailed factual claims as fully validated while the AI gateway is unavailable. For a reliable answer, start from Global Search to check ESUT catalogue records, open-access resources, repository items, theses, and external academic sources. If a result needs librarian confirmation, use the resource request or review option so library staff can verify it.\n\nFor loans, thesis submission, interlibrary loan, reading lists, or account approval, use your dashboard because those services are tied to your patron profile. If the matter is urgent, contact the library desk or use the human librarian referral option.\n\nReferences\nESUT Smart Library catalogue, repository, thesis portal, and open-access search tools.\n\nYour question: ${question}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const key = process.env.AI_GATEWAY_API_KEY;
    const baseUrl = (process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1').replace(/\/$/, '');
    const model = process.env.AI_FAST_MODEL || process.env.AI_DEFAULT_MODEL || 'openai/gpt-4o-mini';

    if (!key) {
      return new Response(fallbackAnswer(messages), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: systemPrompt() }, ...messages] }),
    });

    if (!response.ok) {
      return new Response(fallbackAnswer(messages), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || fallbackAnswer(messages);
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'AI unavailable' }, { status: 500 });
  }
}
