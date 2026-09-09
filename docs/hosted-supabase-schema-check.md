# Hosted Supabase Schema Check

If catalogue or federated search returns no local results, check:

```text
http://localhost:3000/api/health/schema
```

The app expects these hosted Supabase tables for full local search/catalogue behavior:

- `catalogue_items`
- `patrons`
- `resource_harvest_runs`
- `resource_candidates`
- `resource_discovery_logs`

If any are missing, apply the project migrations to the hosted Supabase project. Do not start Supabase Local and do not generate local keys.

Minimum migration files for catalogue/resource search include:

- `supabase/migrations/20260620202651_f5c5362c-dcc6-42fe-8b4a-02413bdff72a.sql`
- `supabase/migrations/20260620221721_c4912609-5936-4583-a676-d7bb4a6851ca.sql`
- `supabase/migrations/20260625142000_foundation_services.sql`
- `supabase/migrations/20260626133000_resource_harvest_discovery.sql`

After applying migrations, restart the app or refresh the browser. Supabase may take a moment to refresh the PostgREST schema cache.
