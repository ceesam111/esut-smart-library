import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEMO_PASSWORD = "ChangeMe123!";
export const SEED_TAG = "demo_seed";
export const SEEDED_BY = "seed-demo-data";
export const RESET_CONFIRMATION = "I_UNDERSTAND_THIS_WILL_DELETE_DEMO_DATA_ONLY";

export type TenantCode = "ESUT" | "OGLB" | "DPL";

export const tenants: Record<TenantCode, { id: string; code: TenantCode; name: string; libraryName: string; type: string; location: string; domain: string; faculty: string }> = {
  ESUT: { id: "00000000-0000-0000-0000-000000000001", code: "ESUT", name: "ESUT Smart Library", libraryName: "ESUT Smart Library", type: "university", location: "Enugu, Nigeria", domain: "esut.edu.ng", faculty: "SCI" },
  OGLB: { id: "00000000-0000-0000-0000-000000000002", code: "OGLB", name: "OGLB Digital Library", libraryName: "Ogun State Library Board Digital Library", type: "state library board", location: "Ogun State, Nigeria", domain: "oglb.test", faculty: "PUB" },
  DPL: { id: "00000000-0000-0000-0000-000000000003", code: "DPL", name: "Demo Polytechnic Library", libraryName: "Demo Polytechnic Library", type: "polytechnic", location: "Nigeria", domain: "library.test", faculty: "SCI" },
};

export const departments = [
  ["Computer Science", "CSC"],
  ["Library and Information Science", "LIS"],
  ["Education", "EDU"],
  ["Business Administration", "BUS"],
  ["Mass Communication", "MAC"],
  ["Biology", "BIO"],
  ["Chemistry", "CHM"],
  ["Mathematics", "MTH"],
  ["English", "ENG"],
  ["Political Science", "POL"],
  ["Accounting", "ACC"],
  ["Public Administration", "PAD"],
] as const;

export function loadDotEnv() {
  for (const envPath of [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")]) {
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

export function assertSafeEnvironment(options: { destructive?: boolean; dryRun?: boolean } = {}) {
  loadDotEnv();
  if (options.dryRun) return { url: "dry-run", key: "dry-run" };
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

  const target = process.env.SEED_TARGET;
  const allowedTarget = target === "development" || target === "staging" || target === "demo" || process.env.ALLOW_PRODUCTION_SEED === "true";
  if (!allowedTarget) throw new Error("Refusing to seed until SEED_TARGET is development, staging, or demo. Set it explicitly before running against hosted Supabase.");

  if (options.destructive && process.env.SEED_ALLOW_RESET !== RESET_CONFIRMATION) {
    throw new Error(`Refusing destructive reset. Set SEED_ALLOW_RESET=${RESET_CONFIRMATION} to delete demo-tagged data only.`);
  }
  return { url, key };
}

export function createAdminClient(options: { destructive?: boolean; dryRun?: boolean } = {}) {
  const { url, key } = assertSafeEnvironment(options);
  if (options.dryRun) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function tenantCodesFromArgs(): TenantCode[] {
  const code = process.argv.find((arg) => ["ESUT", "OGLB", "DPL"].includes(arg)) as TenantCode | undefined;
  if (code) return [code];
  if (process.argv.includes("--all-tenants")) return ["ESUT", "DPL"];
  return ["ESUT"];
}

export async function optional<T>(label: string, action: () => PromiseLike<T>) {
  try {
    return await retry(action);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Could not find the table|schema cache|does not exist|column .* does not exist|PGRST20|42P01|42703/i.test(message)) {
      console.warn(`Skipping ${label}: schema object is not available.`);
      return undefined;
    }
    throw error;
  }
}

export async function requireNoError<T>(query: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function retry<T>(action: () => PromiseLike<T>, attempts = 6) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      const retryable = /fetch failed|UND_ERR_SOCKET|ECONNRESET|ETIMEDOUT|other side closed|network/i.test(message);
      if (!retryable || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}

export function seededEmail(code: TenantCode, role: string, index?: number) {
  const suffix = index ? String(index).padStart(3, "0") : "";
  return `${role.toLowerCase()}${suffix}.${code.toLowerCase()}@${tenants[code].domain}`;
}

export async function ensureUser(supabase: SupabaseClient, email: string, fullName: string) {
  const { data: users, error: listError } = await retry(() => supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }));
  if (listError) throw listError;
  const existing = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    return existing.id;
  }
  const { data, error } = await retry(() => supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, seeded: true, seed_tag: SEED_TAG },
  }));
  if (error) throw error;
  return data.user.id;
}

export async function removeSeededUsers(supabase: SupabaseClient, emails: string[]) {
  const normalized = new Set(emails.map((email) => email.toLowerCase()));
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  for (const user of data.users) {
    if (user.email && normalized.has(user.email.toLowerCase())) await supabase.auth.admin.deleteUser(user.id);
  }
}

export function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
}
