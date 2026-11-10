import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are Lexis, AI Reference Librarian of ESUT Smart Library. Answer all library and academic questions across all disciplines. Include APA 7th edition in-text citations and full references for academic answers. Only cite sources from 2015–present. Never fabricate citations.`;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ProviderConfig {
  name: string;
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
  enabled: boolean;
}

function getProviders(): ProviderConfig[] {
  const gatewayKey = Deno.env.get("AI_GATEWAY_API_KEY");
  const gatewayBase = Deno.env.get("AI_GATEWAY_BASE_URL") ?? "https://ai-gateway.vercel.sh/v1";
  const defaultModel = Deno.env.get("AI_FAST_MODEL") ?? Deno.env.get("AI_DEFAULT_MODEL") ?? "openai/gpt-4o-mini";

  const ollamaBase = Deno.env.get("OLLAMA_BASE_URL");
  const ollamaModel = Deno.env.get("OLLAMA_MODEL") ?? "llama3.2";
  const ollamaEnabled = Deno.env.get("OLLAMA_ENABLED") === "true" || !!ollamaBase;

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const geminiBase = Deno.env.get("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai";
  const geminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";

  const groqKey = Deno.env.get("GROQ_API_KEY");
  const groqBase = Deno.env.get("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1";
  const groqModel = Deno.env.get("GROQ_MODEL") ?? "qwen/qwen3.8-27b";

  const nvidiaKey = Deno.env.get("NVIDIA_API_KEY") ?? Deno.env.get("NIM_API_KEY");
  const nvidiaBase = Deno.env.get("NVIDIA_BASE_URL") ?? "https://integrate.api.nvidia.com/v1";
  const nvidiaModel = Deno.env.get("NVIDIA_MODEL") ?? "meta/llama-3.1-70b-instruct";

  const providers: ProviderConfig[] = [];

  // Free providers first (priority order)
  if (ollamaEnabled && ollamaBase) {
    providers.push({ name: "ollama", apiKey: null, baseUrl: ollamaBase.replace(/\/$/, ""), model: ollamaModel, enabled: true });
  }
  if (geminiKey) {
    providers.push({ name: "gemini", apiKey: geminiKey, baseUrl: geminiBase.replace(/\/$/, ""), model: geminiModel, enabled: true });
  }
  if (groqKey) {
    providers.push({ name: "groq", apiKey: groqKey, baseUrl: groqBase.replace(/\/$/, ""), model: groqModel, enabled: true });
  }
  if (nvidiaKey) {
    providers.push({ name: "nvidia", apiKey: nvidiaKey, baseUrl: nvidiaBase.replace(/\/$/, ""), model: nvidiaModel, enabled: true });
  }

  // Paid gateway last
  if (gatewayKey) {
    providers.push({ name: "gateway", apiKey: gatewayKey, baseUrl: `${gatewayBase.replace(/\/$/, "")}/chat/completions`, model: defaultModel, enabled: true });
  }

  return providers;
}

async function tryProvider(provider: ProviderConfig, messages: Message[]): Promise<{ ok: boolean; body?: ReadableStream; status?: number; error?: string }> {
  try {
    const base = provider.baseUrl!.endsWith("/chat/completions")
      ? provider.baseUrl!
      : `${provider.baseUrl!}/chat/completions`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    const res = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 1024,
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`${provider.name} error:`, res.status, errText);
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }

    return { ok: true, body: res.body! };
  } catch (err) {
    console.error(`${provider.name} fetch error:`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function transformStream(readable: ReadableStream): ReadableStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = readable.getReader();
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
      // Legacy: single message (non-streamed JSON reply)
      const providers = getProviders();
      if (providers.length === 0) {
        return new Response(JSON.stringify({ reply: "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const firstProvider = providers[0];
      const base = firstProvider.baseUrl!.endsWith("/chat/completions")
        ? firstProvider.baseUrl!
        : `${firstProvider.baseUrl!}/chat/completions`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (firstProvider.apiKey) headers["Authorization"] = `Bearer ${firstProvider.apiKey}`;

      const res = await fetch(base, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: firstProvider.model,
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

    // First message must be from the user
    const firstUserIdx = messages.findIndex((m) => m.role === "user");
    const apiMessages = firstUserIdx >= 0 ? messages.slice(firstUserIdx) : [];

    if (apiMessages.length === 0) {
      return new Response("Please ask me a question and I'll be happy to help!", {
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const providers = getProviders();

    if (providers.length === 0) {
      return new Response(
        "I'm sorry, the AI service is not configured right now. Please contact the library for assistance.",
        { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // Try each provider in order (free first, paid gateway last)
    let lastError = "";
    for (const provider of providers) {
      const result = await tryProvider(provider, apiMessages);
      if (result.ok && result.body) {
        const readable = transformStream(result.body);
        return new Response(readable, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/plain; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      lastError = result.error ?? `HTTP ${result.status}`;
    }

    // All providers failed
    if (lastError.includes("402") || lastError.includes("429")) {
      return new Response(
        "I'm receiving a lot of questions right now. Please try again in a moment.",
        { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    return new Response(
      "I'm temporarily unavailable. Please try again in a moment.",
      { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      "An unexpected error occurred. Please try again.",
      { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
});
