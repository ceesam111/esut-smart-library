# ESUT Smart Library

The official digital library platform for **Enugu State University of Science and Technology (ESUT)**.

Built with Next.js, React, TypeScript, and Supabase. Designed for production deployment on Coolify.

## Features

- **Catalogue Search** — Full-text search across books, theses, dissertations, and journals
- **Institutional Repository** — Thesis and research paper management
- **AI Research Librarian (Lexis)** — AI-powered research assistance with citation generation
- **Patron Management** — Registration, approval workflows, library cards
- **Circulation** — Loans, returns, renewals, reservations, fines
- **Admin Dashboard** — Catalogue management, reports, analytics
- **Electronic Resources** — Database access, e-journals, digital collections
- **Single Library Mode** — Optimized for ESUT's single main library

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS 4 |
| Framework | Next.js 14 (App Router) |
| UI | Radix UI + shadcn/ui |
| Auth | Supabase Auth |
| Database | PostgreSQL (Supabase) |
| Storage | Backblaze B2 + Supabase Storage |
| AI | Vercel AI Gateway |
| Email | Resend |
| Security | Arcjet + CSP + CSRF |
| Testing | Vitest + Playwright |
| Deployment | Docker + Coolify |

## Quick Start

### Prerequisites

- Node.js 20+
- npm or bun
- Supabase project

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker Development

```bash
cp .env.development.example .env.development
docker compose -f docker-compose.dev.yml up --build
```

### Production Build

```bash
npm run build
npm start
```

### Docker Production

```bash
docker build -t esut-smart-library .
docker run -p 3000:3000 --env-file .env esut-smart-library
```

## Environment Variables

See `.env.example` for all required variables. Key variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret (server-only) |
| `RESEND_API_KEY` | Resend email API key |
| `APP_BASE_URL` | Application base URL |

**Never commit `.env` files or expose secrets in client-side code.**

## Project Structure

```
├── app/              # Next.js App Router (API routes, layout)
├── src/
│   ├── app-pages/    # React page components
│   ├── components/   # Reusable UI components
│   ├── config/       # Institution & role configuration
│   ├── hooks/        # React hooks
│   ├── lib/          # Utilities & helpers
│   ├── server/       # Server-side logic
│   └── styles.css    # Design system tokens
├── supabase/         # Database migrations & edge functions
├── public/           # Static assets
├── worker/           # Background worker service
└── scripts/          # Utility scripts
```

## Configuration

### Institution Config

Edit `src/config/institution.config.ts` to customize:

- Institution name and branding
- Library configuration
- Academic calendar
- Loan rules
- Feature flags

### Single Library Mode

ESUT runs in single-library mode. To enable multi-branch support:

```typescript
// src/config/institution.config.ts
libraryMode: "multi",
branchLibraries: [
  { name: "Branch Name", slug: "branch-slug", code: "BRC", description: "..." },
],
```

## Deployment

### Coolify

See `DEPLOYMENT.md` for detailed Coolify deployment instructions.

Key steps:
1. Connect Git repository
2. Set build arguments (NEXT_PUBLIC_* variables)
3. Set runtime environment variables
4. Configure domain and HTTPS
5. Deploy

### Health Check

```
GET /api/health
```

Returns `{ ok: true, service: "esut-smart-library" }`.

## Testing

```bash
# Unit tests
npm test

# Lint
npm run lint

# Build verification
npm run build
```

## Documentation

- `DEPLOYMENT.md` — Coolify deployment guide
- `ARCHITECTURE.md` — Technical architecture
- `DATABASE_MIGRATION.md` — Database migration guide
- `.env.example` — Environment variable reference

## License

Proprietary — Enugu State University of Science and Technology.
