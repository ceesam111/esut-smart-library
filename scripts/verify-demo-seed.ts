import { createAdminClient, optional, requireNoError, tenantCodesFromArgs, tenants } from "./demo-seed-lib";

const supabase = createAdminClient();
if (!supabase) throw new Error("Supabase client was not initialized.");

let failed = false;

async function count(label: string, query: PromiseLike<{ count: number | null; error: unknown }>, minimum: number) {
  const result = await optional(label, () => query);
  const value = result?.count ?? 0;
  const ok = value >= minimum;
  console.log(`${ok ? "OK" : "FAIL"} ${label}: ${value} expected >= ${minimum}`);
  if (!ok) failed = true;
}

for (const code of tenantCodesFromArgs()) {
  const tenant = tenants[code];
  await count(`${code} patrons`, supabase.from("patrons").select("id", { count: "exact", head: true }).like("patron_id", `${code}-DEMO-%`), 10);
  await count(`${code} roles`, supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id), 8);
  await count(`${code} catalogue`, supabase.from("catalogue_items").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("source_name", "demo_seed"), 20);
  await count(`${code} copies`, supabase.from("catalogue_copies").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id), 20);
  await count(`${code} loans`, supabase.from("loans").select("id", { count: "exact", head: true }), 1);
  await count(`${code} repository`, supabase.from("repository_items").select("id", { count: "exact", head: true }).like("title", `${code} Demo:%`), 5);
  await count(`${code} approvals`, supabase.from("approval_queue").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id), 4);
  await count(`${code} staging`, supabase.from("catalogue_staging").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id), 4);
  await count(`${code} harvest candidates`, supabase.from("resource_candidates").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id), 4);
  await count(`${code} events`, supabase.from("events").select("id", { count: "exact", head: true }).like("title", `${code} Demo:%`), 4);
  await count(`${code} notifications`, supabase.from("notifications").select("id", { count: "exact", head: true }), 1);
  await count(`${code} agent runs`, supabase.from("agent_runs").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id), 4);
}

if (failed) process.exitCode = 1;
else await requireNoError(Promise.resolve({ data: true, error: null }));
