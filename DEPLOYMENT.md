# ESUT Smart Library — Deployment Guide

## Overview

The ESUT Smart Library is a Next.js application deployed via Docker on Coolify. It uses Supabase for authentication, database, and storage.

## Prerequisites

- Coolify instance running
- Docker support enabled
- Supabase project configured
- Backblaze B2 bucket (optional, for file storage)
- Resend account (for transactional emails)

## Environment Variables

### Required (Build-time)

These must be set as build arguments in Coolify:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Public app URL | `https://esutlibrary.edu.ng` |
| `NEXT_PUBLIC_APP_BASE_URL` | Public app base URL | `https://esutlibrary.edu.ng` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | `sb_publishable_...` |

### Required (Runtime)

These must be set as environment variables in Coolify:

| Variable | Description |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret (server-only) |
| `RESEND_API_KEY` | Resend email API key (server-only) |
| `FROM_EMAIL` | Sender email address |
| `RESEND_FROM_EMAIL` | Resend verified sender email |
| `FROM_NAME` | Sender display name |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `B2_ENDPOINT` | Backblaze B2 S3 endpoint | |
| `B2_KEY_ID` | B2 key ID | |
| `B2_APPLICATION_KEY` | B2 application key | |
| `B2_BUCKET_LIBRARY_FILES` | B2 bucket for library files | |
| `B2_BUCKET_BACKUPS` | B2 bucket for backups | |
| `B2_BUCKET_EXPORTS` | B2 bucket for exports | |
| `AI_GATEWAY_API_KEY` | Vercel AI gateway key | |
| `ARCJET_KEY` | Arcjet security key | |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` |

## Coolify Configuration

### Application Settings

1. **Repository**: Connect your Git repository
2. **Branch**: `main` (or your deployment branch)
3. **Build Pack**: Dockerfile
4. **Dockerfile Location**: `/Dockerfile` (root)
5. **Port**: `3000`

### Build Configuration

Set the following build arguments in Coolify:

```
NEXT_PUBLIC_APP_URL=https://esutlibrary.edu.ng
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

### Runtime Environment

Set the following environment variables in Coolify:

```
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_JWT_SECRET=<your-jwt-secret>
RESEND_API_KEY=<your-resend-key>
FROM_EMAIL=library@esut.edu.ng
RESEND_FROM_EMAIL=send@esutlibrary.edu.ng
FROM_NAME=ESUT Library
APP_BASE_URL=https://esutlibrary.edu.ng
```

### Health Check

The application includes a health check endpoint at `/api/health` that returns:

```json
{
  "ok": true,
  "service": "esut-smart-library",
  "timestamp": "2026-09-07T12:00:00.000Z"
}
```

### Domain Configuration

1. Set your domain in Coolify (e.g., `esutlibrary.edu.ng`)
2. Enable HTTPS (automatic via Let's Encrypt)
3. Set up redirect from `www` if needed

### Supabase Configuration

Update your Supabase project settings:

1. **Authentication > URL Configuration**:
   - Site URL: `https://esutlibrary.edu.ng`
   - Redirect URLs: Add `https://esutlibrary.edu.ng/**`

2. **Authentication > Email Templates**:
   - Update all templates to reference "ESUT Library" instead of "AFUED Library"

## Worker Service (Optional)

The smart library worker runs as a separate Docker service:

1. Enable the `worker` profile in Coolify
2. Set the worker environment variables
3. The worker health check runs on port `8787`

## Database Migrations

Run Supabase migrations in order:

1. Use the SQL files in `supabase/migrations/`
2. Apply them sequentially via the Supabase dashboard SQL editor
3. The initial schema creates all required tables, RLS policies, and functions

## Post-Deployment Checklist

- [ ] Verify health check returns 200
- [ ] Test login/registration flow
- [ ] Verify catalogue search works
- [ ] Check admin dashboard loads
- [ ] Test email notifications
- [ ] Verify file uploads work (if B2 configured)
- [ ] Check responsive design on mobile
- [ ] Verify all AFUED branding is removed
- [ ] Test the AI librarian (Lexis)
