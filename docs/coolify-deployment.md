# Coolify Deployment

## Deploy From GitHub

1. Push the app repository to GitHub.
2. In Coolify, create a new resource from the GitHub repository.
3. Choose Dockerfile-based deployment.
4. Set build context to the app folder if the repository root is not `esut-smart-library`.
5. Use `Dockerfile` for the web app.
6. Expose port `3000`.
7. Set health check path to `/api/health`.

## Environment Variables

Set variables in Coolify, not in the Docker image.

Required public build/runtime variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required server-only runtime variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Optional server-only variables:

- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_BASE_URL`
- `AI_DEFAULT_MODEL`
- `B2_ENDPOINT`
- `B2_REGION`
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_LIBRARY_FILES`
- `B2_BUCKET_BACKUPS`
- `RESEND_API_KEY`

Never expose `SUPABASE_SERVICE_ROLE_KEY`, B2 keys, AI Gateway keys, or email keys as `NEXT_PUBLIC_*` variables.

## Build Arguments In Coolify

Because Next.js embeds `NEXT_PUBLIC_*` values into browser bundles, configure these as build arguments too:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not add service-role, B2, AI, or email keys as build arguments.

## Same-Server Testing

For quick testing, deploy the app on the same server as Coolify:

- Use the web app Dockerfile.
- Bind port `3000` internally through Coolify.
- Attach a test domain or use Coolify preview URL.
- Confirm `/api/health` returns `ok: true`.
- Confirm `/api/health/supabase` returns `supabase: reachable`.

## Separate App Server Production

For production, use Coolify control server to manage a separate App Server:

1. Add the App Server in Coolify as a destination/server.
2. Install Docker through Coolify server setup.
3. Deploy this app to the App Server destination.
4. Keep Supabase hosted for now by using hosted Supabase env values.
5. Later point the same env names at self-hosted Supabase.

## Custom Domain And SSL

1. Add the custom domain in the Coolify app settings.
2. Point DNS `A`/`CNAME` to the App Server or Coolify proxy target.
3. Enable SSL/Let’s Encrypt in Coolify.
4. Set `NEXT_PUBLIC_APP_URL`, `APP_BASE_URL`, and `CORS_ALLOWED_ORIGINS` to the HTTPS domain.
5. Redeploy after changing public env/build args.

## Optional Worker

Worker code exists and can be deployed separately with `Dockerfile.worker` or via `docker-compose.prod.yml --profile worker`. It uses the same hosted Supabase env values and must receive `SUPABASE_SERVICE_ROLE_KEY` only at runtime.

## Switching Supabase Later

To switch from hosted Supabase to self-hosted Supabase, change only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY` if used as an alias

Then redeploy so browser-visible values are rebuilt into the Next.js client bundle.
