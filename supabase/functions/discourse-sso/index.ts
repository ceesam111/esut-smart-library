import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DISCOURSE_URL    = Deno.env.get("DISCOURSE_URL") ?? "";
const DISCOURSE_SECRET = Deno.env.get("DISCOURSE_SECRET") ?? "";

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlDecode(str: string): string {
  // Pad if necessary
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!DISCOURSE_URL || !DISCOURSE_SECRET) {
    return new Response("Discourse SSO not configured", { status: 503, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const sso = url.searchParams.get("sso") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  // ── Verify signature from Discourse ──────────────────────────────────────
  if (sso && sig) {
    const expectedSig = await hmacSha256Hex(DISCOURSE_SECRET, sso);
    if (expectedSig !== sig) {
      return new Response("Invalid SSO signature", { status: 403, headers: corsHeaders });
    }

    // Decode nonce
    const decoded = base64UrlDecode(sso);
    const params = new URLSearchParams(decoded);
    const nonce = params.get("nonce");
    const returnUrl = params.get("return_sso_url") ?? `${DISCOURSE_URL}/session/sso_login`;

    if (!nonce) {
      return new Response("Missing nonce", { status: 400, headers: corsHeaders });
    }

    // ── Get the authenticated Supabase user ─────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Attempt to get user from JWT bearer token
    let userId: string | null = null;
    let userEmail = "";
    let userName = "";
    let matricNo = "";
    let avatarUrl = "";
    let isAdmin = false;

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email ?? "";

        const { data: patron } = await supabase
          .from("patrons")
          .select("full_name, matric_number, patron_category, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();

        if (patron) {
          userName      = (patron.matric_number ?? patron.full_name ?? userEmail.split("@")[0])
            .replace(/\s+/g, "_")
            .toLowerCase();
          matricNo      = patron.matric_number ?? "";
          avatarUrl     = patron.avatar_url ?? "";
          isAdmin       = patron.patron_category === "Staff" || patron.patron_category === "Librarian";
        } else {
          userName = userEmail.split("@")[0].replace(/\s+/g, "_").toLowerCase();
        }
      }
    }

    if (!userId) {
      // Redirect to login, preserving the SSO return URL
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", `/functions/v1/discourse-sso?sso=${sso}&sig=${sig}`);
      return Response.redirect(loginUrl.toString(), 302);
    }

    // ── Build response payload ──────────────────────────────────────────────
    const payload: Record<string, string> = {
      nonce,
      external_id: userId,
      email: userEmail,
      username: userName,
      name: userName.replace(/_/g, " "),
    };
    if (avatarUrl)  payload.avatar_url   = avatarUrl;
    if (isAdmin)    payload.admin        = "true";

    const rawPayload  = new URLSearchParams(payload).toString();
    const b64Payload  = btoa(rawPayload);
    const responseSig = await hmacSha256Hex(DISCOURSE_SECRET, b64Payload);

    const redirectUrl = new URL(returnUrl);
    redirectUrl.searchParams.set("sso", b64Payload);
    redirectUrl.searchParams.set("sig", responseSig);

    return Response.redirect(redirectUrl.toString(), 302);
  }

  // ── Initial entry — redirect to Discourse SSO page ─────────────────────
  // This path is hit when user clicks "Enter Forum" without Discourse initiating SSO.
  const returnSsoUrl = `${url.origin}/functions/v1/discourse-sso`;
  const initUrl      = `${DISCOURSE_URL}/session/sso?return_path=${encodeURIComponent(returnSsoUrl)}`;
  return Response.redirect(initUrl, 302);
});
