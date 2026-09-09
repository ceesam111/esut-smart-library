# Database Migration Notes

The current application still uses Supabase HTTP/Auth/Storage/Edge Function APIs through `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

The synchronized SQL schema lives in `supabase/migrations`. To bootstrap a Docker PostgreSQL database for local migration work, run:

```bash
docker compose up postgres
```

The `postgres` service mounts `supabase/migrations` and applies each SQL migration in filename order on first database initialization.

For a full move away from Supabase hosted APIs, add server-side data access through `DATABASE_URL` and replace Supabase Auth/Storage/Edge Function calls with equivalent PostgreSQL-backed services.
