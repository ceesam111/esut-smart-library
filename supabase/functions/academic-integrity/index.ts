import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey",
};

const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
const AI_GATEWAY = `${(Deno.env.get("AI_GATEWAY_BASE_URL") ?? "https://ai-gateway.vercel.sh/v1").replace(/\/$/, "")}/chat/completions`;
const MODEL = Deno.env.get("AI_REASONING_MODEL") ?? Deno.env.get("AI_DEFAULT_MODEL") ?? "openai/gpt-4o-mini";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CURRENT_YEAR = new Date().getFullYear();
const OUTDATED_BEFORE = CURRENT_YEAR - 10; // citations older than 10 years are flagged

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Extract a JSON object from an AI text response that may be wrapped in code fences. */
function extractJson(text: string): any {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callAI(system: string, user: string, maxTokens = 1200): Promise<any> {
  if (!AI_GATEWAY_API_KEY) throw new Error("AI service not configured");
  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (res.status === 429) throw new Error("rate_limit");
  if (res.status === 402) throw new Error("payment_required");
  if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
  const data = await res.json();
  return extractJson(data.choices?.[0]?.message?.content ?? "");
}

// ── Plagiarism / originality analysis ───────────────────────────────────────
async function analysePlagiarism(text: string) {
  const system =
    "You are an academic integrity analysis engine. Assess the provided text for likely UNORIGINAL content " +
    "(generic boilerplate, uncited common phrasing, or text that reads as copied) and for likely AI-GENERATED content. " +
    "You do NOT have web access, so you cannot match exact external sources — provide an indicative assessment only. " +
    'Respond ONLY with strict JSON of the form: {"similarity_score": <0-100 number>, "ai_content_score": <0-100 number>, ' +
    '"summary": "<one sentence>", "flagged_passages": [{"text":"<short excerpt>","reason":"<why flagged>"}], ' +
    '"matched_sources": [{"description":"<likely type/origin of similar material>","similarity":<0-100>}]}. ' +
    "Keep flagged_passages to at most 5 short excerpts. Be conservative and realistic with scores.";
  const user = `Analyse this text:\n\n"""${text.slice(0, 8000)}"""`;
  const result = await callAI(system, user, 1400);
  return {
    similarity_score: Number(result?.similarity_score ?? 0),
    ai_content_score: Number(result?.ai_content_score ?? 0),
    summary: String(result?.summary ?? ""),
    flagged_passages: Array.isArray(result?.flagged_passages) ? result.flagged_passages.slice(0, 5) : [],
    matched_sources: Array.isArray(result?.matched_sources) ? result.matched_sources.slice(0, 8) : [],
  };
}

// ── APA 7th citation validation ─────────────────────────────────────────────
async function analyseCitations(text: string) {
  const system =
    "You are an APA 7th edition citation checker. The user pastes a reference list and/or in-text citations. " +
    "Validate each reference against APA 7th edition formatting rules (author, year, title casing, source, DOI/URL). " +
    'Respond ONLY with strict JSON: {"citations": [{"reference":"<the citation as given>","year":<4-digit year or null>,' +
    '"valid":<true|false>,"issues":["<formatting problem>"],"corrected":"<APA 7th corrected form or empty>"}]}. ' +
    "List every reference you can identify. If a reference is correctly formatted, set valid=true and issues=[].";
  const user = `Check these citations (APA 7th):\n\n"""${text.slice(0, 8000)}"""`;
  const result = await callAI(system, user, 1800);
  const citations = Array.isArray(result?.citations) ? result.citations : [];
  let outdated = 0;
  const enriched = citations.map((c: any) => {
    const year = c?.year && Number.isFinite(Number(c.year)) ? Number(c.year) : null;
    const isOutdated = year !== null && year < OUTDATED_BEFORE;
    if (isOutdated) outdated += 1;
    return {
      reference: String(c?.reference ?? ""),
      year,
      valid: Boolean(c?.valid),
      issues: Array.isArray(c?.issues) ? c.issues : [],
      corrected: String(c?.corrected ?? ""),
      outdated: isOutdated,
    };
  });
  return { citations: enriched, citation_count: enriched.length, outdated_count: outdated };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = body.action as string;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve the calling user (if any) from the bearer token.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    }

    if (action === "plagiarism") {
      const text = String(body.text ?? "").trim();
      if (text.length < 40) return json({ error: "Please provide at least 40 characters of text." }, 400);
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const result = await analysePlagiarism(text);

      if (userId) {
        await admin.from("integrity_scans").insert({
          user_id: userId,
          scan_type: "plagiarism",
          title: String(body.title ?? "").slice(0, 200) || null,
          word_count: wordCount,
          similarity_score: result.similarity_score,
          ai_content_score: result.ai_content_score,
          matched_sources: result.matched_sources,
          flagged_passages: result.flagged_passages,
        });
      }
      return json({ success: true, wordCount, ...result });
    }

    if (action === "citation") {
      const text = String(body.text ?? "").trim();
      if (text.length < 10) return json({ error: "Please paste at least one citation." }, 400);
      const result = await analyseCitations(text);

      if (userId) {
        await admin.from("integrity_scans").insert({
          user_id: userId,
          scan_type: "citation",
          title: String(body.title ?? "").slice(0, 200) || null,
          citation_style: "APA 7th",
          citation_issues: result.citations,
          citation_count: result.citation_count,
          outdated_count: result.outdated_count,
        });
      }
      return json({ success: true, currentYear: CURRENT_YEAR, outdatedBefore: OUTDATED_BEFORE, ...result });
    }

    if (action === "scan-repository") {
      // Background scan for an uploaded repository item. Uses service role.
      const itemId = String(body.itemId ?? "");
      if (!itemId) return json({ error: "itemId required" }, 400);
      const { data: item, error } = await admin
        .from("repository_items")
        .select("id, title, abstract, keywords, submitter_id")
        .eq("id", itemId)
        .single();
      if (error || !item) return json({ error: "Item not found" }, 404);

      const parts = [item.title, item.abstract, Array.isArray(item.keywords) ? item.keywords.join(", ") : ""]
        .filter(Boolean)
        .join("\n\n");
      const text = parts.trim();
      if (text.length < 40) {
        return json({ success: true, skipped: true, reason: "Insufficient text to scan." });
      }

      const result = await analysePlagiarism(text);
      const now = new Date().toISOString();
      await admin
        .from("repository_items")
        .update({
          similarity_score: result.similarity_score,
          ai_content_score: result.ai_content_score,
          matched_sources: result.matched_sources,
          plagiarism_scanned_at: now,
        })
        .eq("id", itemId);

      await admin.from("integrity_scans").insert({
        user_id: item.submitter_id ?? null,
        scan_type: "plagiarism",
        title: item.title,
        word_count: text.split(/\s+/).filter(Boolean).length,
        similarity_score: result.similarity_score,
        ai_content_score: result.ai_content_score,
        matched_sources: result.matched_sources,
        flagged_passages: result.flagged_passages,
        repository_item_id: itemId,
      });

      const warn = result.similarity_score > 20;
      return json({
        success: true,
        similarity_score: result.similarity_score,
        ai_content_score: result.ai_content_score,
        warn,
        message: warn
          ? `This document may contain substantial unoriginal content (${Math.round(result.similarity_score)}% similarity detected). Please review before submission.`
          : null,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "rate_limit") return json({ error: "Service busy — please try again shortly." }, 429);
    if (msg === "payment_required") return json({ error: "AI usage limit reached." }, 402);
    return json({ error: msg }, 500);
  }
});
