import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
const AI_GATEWAY = `${(Deno.env.get("AI_GATEWAY_BASE_URL") ?? "https://ai-gateway.vercel.sh/v1").replace(/\/$/, "")}/chat/completions`;
const MODEL = Deno.env.get("AI_FAST_MODEL") ?? Deno.env.get("AI_DEFAULT_MODEL") ?? "openai/gpt-4o-mini";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

function systemPrompt(topic: string) {
  return `You are "Calm", a warm, supportive wellbeing companion for students and staff of ESUT Smart Library in Nigeria. The user is doing a gentle check-in about ${topic}.

Your style:
- Be brief, kind and conversational (2–5 sentences). Use plain, encouraging language.
- Listen and reflect feelings before offering one small, practical coping idea at a time.
- Suggest evidence-based self-care: breathing, grounding (5-4-3-2-1), short walks, sleep, connection, breaking tasks down.
- Never diagnose, never prescribe medication, never give clinical/medical instructions.
- You are NOT a replacement for professional help.

Safety: If the user expresses thoughts of self-harm, suicide, or being unsafe, gently and clearly encourage them to reach out NOW to someone they trust, the ESUT Counselling Unit, the Nigeria mental-health helpline MANI on 0809 111 6264, SURPIN on 0908 021 7555, or emergency services. Stay caring and non-judgemental.

End naturally; do not use clinical jargon. Keep cultural sensitivity for a Nigerian university context.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const topic: string = typeof body.topic === "string" ? body.topic : "how they are feeling";
    const incoming: Message[] = Array.isArray(body.messages) ? body.messages : [];

    if (!AI_GATEWAY_API_KEY) {
      return new Response(
        JSON.stringify({
          reply:
            "I'm here for you. Take a slow breath in for four counts, hold for four, and out for six. What's weighing on you most right now?",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messages: Message[] = [
      { role: "system", content: systemPrompt(topic) },
      ...incoming.filter((m) => m.role === "user" || m.role === "assistant").slice(-12),
    ];

    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "credits_exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
