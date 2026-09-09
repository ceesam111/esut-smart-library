import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
const AI_GATEWAY = `${(Deno.env.get("AI_GATEWAY_BASE_URL") ?? "https://ai-gateway.vercel.sh/v1").replace(/\/$/, "")}/chat/completions`;
const MODEL = Deno.env.get("AI_FAST_MODEL") ?? Deno.env.get("AI_DEFAULT_MODEL") ?? "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are Lexis, AI Reference Librarian of ESUT Smart Library. Answer all library and academic questions across all disciplines. Include APA 7th edition in-text citations and full references for academic answers. Only cite sources from 2015–present. Never fabricate citations.`;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
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
    let messages: Message[] = [];

    if (body.messages && Array.isArray(body.messages)) {
      messages = body.messages;
    } else if (body.message && typeof body.message === "string") {
      // Legacy: single message (e.g. subject heading generation), non-streamed JSON reply
      if (!AI_GATEWAY_API_KEY) {
        return new Response(JSON.stringify({ reply: "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 256,
          messages: [{ role: "user", content: body.message }],
        }),
      });
      const data = await res.json();
      return new Response(
        JSON.stringify({ reply: data.choices?.[0]?.message?.content ?? "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!AI_GATEWAY_API_KEY) {
      return new Response(
        "I'm sorry, the AI service is not configured right now. Please contact the library for assistance.",
        { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // First message must be from the user
    const firstUserIdx = messages.findIndex((m) => m.role === "user");
    const apiMessages = firstUserIdx >= 0 ? messages.slice(firstUserIdx) : [];

    if (apiMessages.length === 0) {
      return new Response("Please ask me a question and I'll be happy to help!", {
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const aiRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...apiMessages],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          "I'm receiving a lot of questions right now. Please try again in a moment.",
          { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          "The AI service is temporarily unavailable. Please contact the library.",
          { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
      return new Response(
        "I'm temporarily unavailable. Please try again in a moment.",
        { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // Transform OpenAI-compatible SSE stream → plain text stream of delta content
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = "";

    const readable = new ReadableStream({
      async start(controller) {
        const reader = aiRes.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length > 0) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      "An unexpected error occurred. Please try again.",
      { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
});
