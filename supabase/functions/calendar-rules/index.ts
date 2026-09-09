import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const sendEmail = async (to: string, name: string, subject: string, html: string) => {
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ to, to_name: name, subject, html }),
      });
    };

    // Load active calendar
    const { data: cal } = await supabase
      .from("academic_calendar")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cal) return json({ ok: false, message: "No academic calendar configured" });

    const today = new Date().toISOString().slice(0, 10);
    const rules: string[] = [];

    const between = (s: string | null, e: string | null) =>
      !!(s && e && today >= s && today <= e);
    const isToday = (d: string | null) => d === today;

    // ── Rule 1: Exam period starts → suspend fines + extend loans ──────────
    if (isToday(cal.exam_one_start) || isToday(cal.exam_two_start)) {
      const examEnd = isToday(cal.exam_one_start) ? cal.exam_one_end : cal.exam_two_end;
      const extendTo = examEnd
        ? new Date(new Date(examEnd).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;

      // Suspend fines: mark loans due during exam as fine-suspended
      await supabase
        .from("loans")
        .update({ fine_suspended: true, updated_at: new Date().toISOString() })
        .eq("status", "active")
        .lte("due_date", examEnd ?? today);

      // Extend loans due before or during exams
      if (extendTo) {
        await supabase
          .from("loans")
          .update({ due_date: extendTo, updated_at: new Date().toISOString() })
          .eq("status", "active")
          .lte("due_date", examEnd ?? today);
      }

      rules.push(`exam_start: fines suspended, loans extended to ${extendTo}`);
    }

    // ── Rule 2: 14 days before semester end → outstanding loan reminders ───
    const sem1End14 = cal.semester_one_end
      ? new Date(new Date(cal.semester_one_end).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null;
    const sem2End14 = cal.semester_two_end
      ? new Date(new Date(cal.semester_two_end).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null;

    if (isToday(sem1End14) || isToday(sem2End14)) {
      const semEnd = isToday(sem1End14) ? cal.semester_one_end : cal.semester_two_end;
      const { data: activeLoans } = await supabase
        .from("loans")
        .select("patron_id, catalogue_items(title)")
        .eq("status", "active");

      const patronMap = new Map<string, string[]>();
      for (const loan of activeLoans ?? []) {
        const title = (loan.catalogue_items as any)?.title ?? "Unknown Item";
        if (!patronMap.has(loan.patron_id)) patronMap.set(loan.patron_id, []);
        patronMap.get(loan.patron_id)!.push(title);
      }

      for (const [patronId, titles] of patronMap) {
        const { data: patron } = await supabase
          .from("patrons")
          .select("email, full_name")
          .eq("id", patronId)
          .maybeSingle();

        if (!patron?.email) continue;
        const itemList = titles.map(t => `<li>${t}</li>`).join("");
        const html = `
          <p>Dear ${patron.full_name ?? "Patron"},</p>
          <p>This is a reminder that the semester ends on <strong>${semEnd}</strong> — 14 days from today.</p>
          <p>You currently have the following items on loan:</p>
          <ul>${itemList}</ul>
          <p>Please ensure all items are returned or renewed before the end of semester to avoid fines.</p>
          <p>The Library Team<br/>Enugu State University of Science and Technology, Enugu</p>
        `;
        await sendEmail(patron.email, patron.full_name ?? patron.email,
          "Reminder: Outstanding Loans Before Semester End — ESUT Library", html);
      }
      rules.push(`14_day_reminder: ${patronMap.size} patrons notified`);
    }

    // ── Rule 3: Exam ends → resume normal fines ────────────────────────────
    if (isToday(cal.exam_one_end) || isToday(cal.exam_two_end)) {
      await supabase
        .from("loans")
        .update({ fine_suspended: false, updated_at: new Date().toISOString() })
        .eq("status", "active")
        .eq("fine_suspended", true);
      rules.push("exam_end: fines resumed");
    }

    // ── Rule 4: Session end → archive reading lists + reset counters ────────
    if (isToday(cal.vacation_start)) {
      // Archive active reading lists
      await supabase
        .from("course_reading_lists")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("is_active", true);

      // Reset click counters
      await supabase
        .from("course_reading_list_items")
        .update({ click_count: 0, updated_at: new Date().toISOString() });

      // Send "See You Next Session" email to all active patrons
      const { data: patrons } = await supabase
        .from("patrons")
        .select("email, full_name")
        .eq("status", "active")
        .not("email", "is", null);

      let count = 0;
      for (const p of patrons ?? []) {
        if (!p.email) continue;
        const html = `
          <p>Dear ${p.full_name ?? "Patron"},</p>
          <p>The <strong>${cal.session}</strong> academic session has now ended. Thank you for using ESUT Library this session.</p>
          <p>All course reading lists have been archived. The library remains open during the long vacation for research and reference purposes.</p>
          <p>We look forward to welcoming you back for the new academic session.</p>
          <p>Have a wonderful vacation!</p>
          <p>The Library Team<br/>Enugu State University of Science and Technology, Enugu</p>
        `;
        await sendEmail(p.email, p.full_name ?? p.email, `See You Next Session — ESUT Library`, html);
        count++;
      }
      rules.push(`session_end: reading lists archived, ${count} patrons notified`);
    }

    // ── Rule 5: New semester start → Welcome Back email ─────────────────────
    if (isToday(cal.semester_one_start) || isToday(cal.semester_two_start)) {
      const semLabel = isToday(cal.semester_one_start) ? "Semester 1" : "Semester 2";

      const { data: patrons } = await supabase
        .from("patrons")
        .select("email, full_name")
        .eq("status", "active")
        .not("email", "is", null);

      let count = 0;
      for (const p of patrons ?? []) {
        if (!p.email) continue;
        const html = `
          <p>Dear ${p.full_name ?? "Patron"},</p>
          <p>Welcome back! <strong>${semLabel}</strong> of the <strong>${cal.session}</strong> academic session begins today.</p>
          <p>Your library account is active and ready. Log in to browse your course reading lists, borrow materials, and access the digital collections.</p>
          <p>The Library Team<br/>Enugu State University of Science and Technology, Enugu</p>
        `;
        await sendEmail(p.email, p.full_name ?? p.email,
          `Welcome Back — ${semLabel} ${cal.session} — ESUT Library`, html);
        count++;
      }
      rules.push(`semester_start (${semLabel}): ${count} patrons notified`);
    }

    return json({ ok: true, date: today, rules_triggered: rules });
  } catch (err) {
    console.error("calendar-rules error:", err);
    return json({ error: String(err) }, 500);
  }
});
