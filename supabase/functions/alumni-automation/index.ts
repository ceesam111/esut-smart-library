import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FINAL_YEAR_LEVELS = ["NCE 3", "400 Level", "Final Year", "400L", "PG2"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get active academic calendar session
    const { data: cal } = await supabase
      .from("academic_calendar")
      .select("session")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cal?.session) return json({ ok: false, message: "No academic calendar configured" });

    const currentSession = cal.session;

    // Find patrons in final year levels whose session_enrolled is not current session
    // These are graduating / graduated students who haven't been converted yet
    const { data: graduating, error: fetchErr } = await supabase
      .from("patrons")
      .select("id, full_name, email, level, patron_category, session_enrolled")
      .in("level", FINAL_YEAR_LEVELS)
      .neq("patron_category", "Alumni")
      .in("patron_category", ["Undergraduate", "Postgraduate Taught", "Postgraduate Research"]);

    if (fetchErr) return json({ error: fetchErr.message }, 500);

    const toConvert = (graduating ?? []).filter(
      (p: any) => !p.session_enrolled || p.session_enrolled !== currentSession,
    );

    if (toConvert.length === 0) return json({ ok: true, converted: 0, message: "No patrons to convert" });

    const ids = toConvert.map((p: any) => p.id);

    const { error: updateErr } = await supabase
      .from("patrons")
      .update({
        patron_category: "Alumni",
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateErr) return json({ error: updateErr.message }, 500);

    // Send alumni status email to each converted patron
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    let emailsSent = 0;
    for (const patron of toConvert) {
      if (!patron.email) continue;
      const html = `
        <p>Dear ${patron.full_name ?? "Patron"},</p>
        <p>Congratulations on completing your programme at Enugu State University of Science and Technology, Enugu!</p>
        <p>Your library account has been transitioned to <strong>Alumni</strong> status for the <strong>${currentSession}</strong> academic session.</p>
        <p>As an alumnus, you retain <strong>read-only access</strong> to the Institutional Repository and digital collections.</p>
        <p>To continue borrowing physical materials, please visit the Library to upgrade to a full Alumni membership.</p>
        <p>We wish you all the best in your future endeavours.</p>
        <p>Warm regards,<br/>The Library Team<br/>Enugu State University of Science and Technology, Enugu</p>
      `;

      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          to: patron.email,
          to_name: patron.full_name ?? patron.email,
          subject: "Your Alumni Library Status — ESUT Library",
          html,
        }),
      });
      emailsSent++;
    }

    return json({ ok: true, converted: toConvert.length, emails_sent: emailsSent });
  } catch (err) {
    console.error("alumni-automation error:", err);
    return json({ error: String(err) }, 500);
  }
});
