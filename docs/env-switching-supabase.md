# Supabase Environment Switching

## Current Mode

Local development and production can both use hosted Supabase credentials.

Use:

- `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SUPABASE_URL=https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=...`

## Future Mode

When self-hosted Supabase is ready, keep the code unchanged and update env values:

- `NEXT_PUBLIC_SUPABASE_URL=https://supabase.your-domain.example`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<self-hosted anon key>`
- `SUPABASE_URL=https://supabase.your-domain.example`
- `SUPABASE_SERVICE_ROLE_KEY=<self-hosted service-role key>`
- `SUPABASE_PUBLISHABLE_KEY=<self-hosted anon/publishable alias if needed>`

## What Must Not Change

- Do not migrate to plain PostgreSQL/Auth.js for this deployment path.
- Do not set up Supabase Local for this app container.
- Do not generate local Supabase keys for production.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

## Verification

1. Check `/api/health` for app health.
2. Check `/api/health/supabase` for backend reachability.
3. Confirm browser requests point to the expected `NEXT_PUBLIC_SUPABASE_URL`.
4. Confirm server logs do not print service-role, B2, AI, or email keys.
5. Redeploy after changing `NEXT_PUBLIC_*` values because those are embedded at build time.
