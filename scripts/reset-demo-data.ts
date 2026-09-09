import { createAdminClient, optional, removeSeededUsers, requireNoError, seededEmail, tenantCodesFromArgs, tenants, type TenantCode } from "./demo-seed-lib";

const supabase = createAdminClient({ destructive: true });
if (!supabase) throw new Error("Supabase client was not initialized.");

function allSeedEmails(code: TenantCode) {
  return [
    seededEmail(code, "admin"),
    seededEmail(code, "librarian", 1),
    seededEmail(code, "librarian", 2),
    seededEmail(code, "faculty.librarian"),
    seededEmail(code, "lecturer", 1),
    seededEmail(code, "lecturer", 2),
    seededEmail(code, "admin.staff", 1),
    seededEmail(code, "admin.staff", 2),
    seededEmail(code, "circulation"),
    ...Array.from({ length: 10 }, (_, index) => seededEmail(code, "student", index + 1)),
  ];
}

for (const code of tenantCodesFromArgs()) {
  const tenant = tenants[code];
  const patrons = await optional("patrons", () => requireNoError(supabase.from("patrons").select("id,user_id").like("patron_id", `${code}-DEMO-%`)));
  const patronIds = patrons?.map((row: any) => row.id) ?? [];
  const userIds = patrons?.map((row: any) => row.user_id).filter(Boolean) ?? [];
  const items = await optional("catalogue_items", () => requireNoError(supabase.from("catalogue_items").select("id").eq("tenant_id", tenant.id).eq("source_name", "demo_seed")));
  const itemIds = items?.map((row: any) => row.id) ?? [];

  if (patronIds.length) {
    await optional("loan_fines", async () => {
      const loans = (await requireNoError(supabase.from("loans").select("id").in("patron_id", patronIds))) ?? [];
      if (loans.length) await requireNoError(supabase.from("loan_fines").delete().in("loan_id", loans.map((row: any) => row.id)));
    });
    for (const table of ["notifications", "event_registrations", "reading_lists", "reservations", "loans", "researchers", "theses", "resource_requests"]) {
      await optional(table, () => requireNoError(supabase.from(table).delete().in("patron_id", patronIds)));
    }
  }

  if (itemIds.length) {
    await optional("catalogue_copies", () => requireNoError(supabase.from("catalogue_copies").delete().in("item_id", itemIds)));
    await optional("course_reserve_items", () => requireNoError(supabase.from("course_reserve_items").delete().in("catalogue_item_id", itemIds)));
  }

  for (const table of ["catalogue_staging", "catalogue_import_batches", "approval_queue", "agent_jobs", "agent_runs", "tenant_ai_usage", "library_objects", "resource_discovery_logs", "resource_candidates", "resource_harvest_runs", "resource_harvest_sources"]) {
    await optional(table, () => requireNoError(supabase.from(table).delete().eq("tenant_id", tenant.id)));
  }

  await optional("repository_items", () => requireNoError(supabase.from("repository_items").delete().like("title", `${code} Demo:%`)));
  await optional("repository_collections", () => requireNoError(supabase.from("repository_collections").delete().like("slug", `${code.toLowerCase()}-demo-%`)));
  await optional("repository_communities", () => requireNoError(supabase.from("repository_communities").delete().like("slug", `${code.toLowerCase()}-demo-%`)));
  await optional("catalogue_items", () => requireNoError(supabase.from("catalogue_items").delete().eq("tenant_id", tenant.id).eq("source_name", "demo_seed")));
  await optional("events", () => requireNoError(supabase.from("events").delete().like("title", `${code} Demo:%`)));
  await optional("blog_posts", () => requireNoError(supabase.from("blog_posts").delete().like("slug", `${code.toLowerCase()}-demo-%`)));
  await optional("announcements", () => requireNoError(supabase.from("announcements").delete().like("title", `${code} Demo:%`)));
  await optional("librarians", () => requireNoError(supabase.from("librarians").delete().in("user_id", userIds)));
  await optional("user_roles", () => requireNoError(supabase.from("user_roles").delete().in("user_id", userIds)));
  await optional("patrons", () => requireNoError(supabase.from("patrons").delete().like("patron_id", `${code}-DEMO-%`)));
  await removeSeededUsers(supabase, allSeedEmails(code));
}

console.log("Demo seed reset complete. Only deterministic demo rows were targeted.");
