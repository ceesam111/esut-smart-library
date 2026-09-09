# ESUT Smart Library Runbook

## Overview

ESUT Smart Library is a Next.js application for the Enugu State University of Science and Technology library. It provides public discovery pages, catalogue and repository access, AI-assisted research help, patron dashboards, and staff administration workflows.

## Runtime Architecture

- Frontend/runtime: Next.js 14 with React and React Router rendered through the Next app catch-all route.
- Hosting: Vercel.
- Backend/data: Supabase database, Auth, Storage, and Edge Functions.
- Authentication: Supabase Auth sessions in the browser.
- Authorization: role rows in `public.user_roles`, checked through helpers such as `has_role` and `is_super_admin`.
- Public configuration: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Main Modules

- Public site: home, catalogue, repository, databases, events, blog, media, lecturers, theses, newspapers, and information pages.
- Patron dashboard: profile, library card, loans, inter-library loan requests, reading lists, thesis, course reserves, and settings.
- Admin dashboard: analytics, patrons, catalogue, repository queue, databases, acquisitions, serials, newspaper index, course reserves, events, CMS, reports, migration, and account management.
- AI services: Lexis AI librarian, wellbeing check-in, federated search, ebook search, content harvest, and other Supabase Edge Functions.

## Environment Variables

Required for Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/publishable key.

Supported aliases used by shared code:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Edge functions use their own Supabase-side secrets, not Vercel secrets. Configure those in Supabase for functions that require `SUPABASE_SERVICE_ROLE_KEY`, `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `AI_FAST_MODEL`, `AI_DEFAULT_MODEL`, `RESEND_API_KEY`, `CORE_API_KEY`, `NCBI_API_KEY`, and related integration keys.

## Local Development

1. Install dependencies with `npm install`.
2. Create `.env.local` from `.env.example` and fill the Supabase public values.
3. Run `npm run dev`.
4. Open the local URL shown by Next.js.

## Production Build

Run `npm run build` from the project root. The app uses `next build` and `output: 'standalone'`.

## Deployment

The production deployment is managed by Vercel and connected to the GitHub repository. Pushes to the connected branch trigger Vercel builds automatically.

Manual deployment:

1. Ensure Vercel environment variables are present.
2. Run `vercel --prod` with the appropriate token, or trigger from the Vercel dashboard.
3. Confirm the production URL loads and public navigation works.

## Super Admin Access

There is no hardcoded super-admin password in the codebase. Super-admin access is controlled by Supabase Auth plus a `super_admin` role in `public.user_roles`.

First super-admin bootstrap flow:

1. Create or register the user in Supabase Auth.
2. Confirm the user can sign in at `/login`.
3. Run the database function `public.bootstrap_super_admin('<email>')` while no other `super_admin` exists.
4. Sign out and sign back in.
5. Open `/admin/accounts` to manage roles and access.

If a `super_admin` already exists, the bootstrap function intentionally disables itself. Existing super admins should assign future roles from `/admin/accounts`.

## Role Model

- `super_admin`: full account and role management plus all staff functions.
- `librarian`: core staff operations.
- `faculty_librarian`: faculty library operations.
- `researcher_lecturer`: researcher/lecturer workflows.
- `student`: patron/student workflows.
- `admin_staff`: administrative workflows.
- `guest`: minimal authenticated access.

## Operational Checks

- Public home page loads.
- `/catalogue`, `/repository`, `/databases`, and `/ai-librarian` render.
- Login succeeds with a Supabase Auth user.
- Dashboard routes require authentication.
- Admin routes show staff navigation only for privileged roles.
- `/admin/accounts` is visible only to `super_admin`.

## Common Troubleshooting

- Missing Supabase error: verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
- Login succeeds but admin access is denied: verify the user has a row in `public.user_roles` with the correct role.
- AI or email functions fail: verify Supabase Edge Function secrets and function deployment status.
- Vercel build fails: run `npm run build` locally and inspect TypeScript/build output.

## Security Notes

- Never commit `.env`, `.env.local`, `.vercel`, `.next`, or `node_modules`.
- Do not expose Supabase service-role keys to the browser or Vercel public environment variables.
- Rotate GitHub/Vercel tokens if they are ever printed or committed.
- Use Supabase RLS policies and role functions for sensitive access control.
