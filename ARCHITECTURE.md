# ESUT Smart Library — Architecture

## Overview

ESUT Smart Library is a modern university digital library platform built for Enugu State University of Science and Technology. It provides catalogue search, institutional repository, AI-powered research assistance, and comprehensive library management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + React SPA |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI + shadcn/ui pattern |
| Forms | React Hook Form + Zod |
| Routing | React Router DOM (client-side SPA) |
| Authentication | Supabase Auth |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage + Backblaze B2 |
| AI | Vercel AI Gateway |
| Email | Resend |
| Security | Arcjet + custom middleware |
| Testing | Vitest + Playwright |
| Deployment | Docker + Coolify |

## Architecture Pattern

The application uses a **hybrid rendering** pattern:

1. **Next.js App Router** provides the production server shell, API routes, and static assets
2. **React SPA** handles all client-side routing via React Router DOM
3. The root `app/page.tsx` dynamically imports the SPA client with `ssr: false`

This gives us:
- Full SPA behavior for users
- Server-side API routes for security-sensitive operations
- Static generation for public pages
- Docker-compatible standalone output

## Directory Structure

```
ESUT SMART LIBRARY/
├── app/                          # Next.js App Router
│   ├── api/                      # Server-side API routes
│   │   ├── admin/                # Admin API endpoints
│   │   ├── ai/                   # AI librarian endpoints
│   │   ├── health/               # Health check
│   │   ├── registration/         # Registration flow
│   │   └── ...
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # SPA entry point
├── src/
│   ├── app-pages/                # React page components (SPA)
│   ├── components/               # Reusable UI components
│   │   ├── auth/                 # Auth forms
│   │   ├── dashboard/            # Dashboard components
│   │   ├── layout/               # Navbar, Footer, Layouts
│   │   ├── ui/                   # Base UI components
│   │   └── ...
│   ├── config/                   # Configuration
│   │   ├── institution.config.ts # ESUT institution config
│   │   └── roles.config.ts       # Role definitions
│   ├── data/                     # Static data files
│   ├── hooks/                    # React hooks
│   ├── integrations/             # Supabase client
│   ├── lib/                      # Utilities
│   ├── server/                   # Server-side logic
│   │   ├── ai/                   # AI brain, gateway
│   │   ├── auth/                 # Auth, roles, permissions
│   │   ├── catalogue/            # Catalogue operations
│   │   ├── resources/            # Resource discovery
│   │   ├── supabase/             # Supabase admin client
│   │   └── ...
│   ├── views/                    # Legacy view components
│   ├── App.tsx                   # React Router definition
│   ├── ClientApp.tsx             # SPA wrapper
│   └── styles.css                # Global styles + design tokens
├── supabase/
│   ├── migrations/               # SQL migrations
│   ├── functions/                # Edge functions
│   └── seed.sql                  # Seed data
├── public/                       # Static assets
├── worker/                       # Background worker service
├── scripts/                      # Utility scripts
├── docker/                       # Docker configuration
├── Dockerfile                    # Production Docker build
├── docker-compose.yml            # Docker Compose
├── middleware.ts                  # Next.js edge middleware
└── tailwind.config.js            # Tailwind configuration
```

## Authentication Flow

1. **Registration**: User fills form → `supabase.auth.signUp()` → row inserted into `patrons` table → email verification
2. **Login**: User signs in → `supabase.auth.signInWithPassword()` → role determined from `user_roles` and `patrons` tables
3. **Session**: JWT stored in localStorage → auto-refresh → Bearer token sent to API routes
4. **Authorization**: Client-side `useAuth()` hook + server-side `requireUser()`/`requireRole()` + Supabase RLS

## Role System

| Role | Dashboard | Key Permissions |
|------|-----------|-----------------|
| `super_admin` | Admin | All features |
| `catalog_admin` | Admin | Catalogue, approvals |
| `ir_admin` | Admin | Repository, IR admin |
| `librarian` | Admin | Full library operations |
| `faculty_librarian` | Admin | Faculty-scoped operations |
| `student` | Dashboard | Catalogue, AI, community |
| `researcher_lecturer` | Dashboard | + Repository submit |
| `admin_staff` | Dashboard | Basic access |
| `guest` | Public | Catalogue, news |

## Security Layers

1. **Edge Middleware**: CORS, CSRF protection, rate limiting, bot detection
2. **API Authentication**: Bearer token validation via Supabase JWT
3. **RLS Policies**: Database-level row security
4. **Role Checks**: Client and server role validation
5. **CSP Headers**: Content Security Policy
6. **Input Validation**: Zod schemas on all API inputs

## Single Library Mode

ESUT operates a single main library. The `libraryMode` config controls this:

```typescript
// src/config/institution.config.ts
libraryMode: "single"  // Hides branch selection UI
```

Branch library architecture is preserved but hidden. Setting `libraryMode: "multi"` and populating `branchLibraries` restores full multi-branch support.

## Database Schema (Key Tables)

- `patrons` - Library members
- `user_roles` - Role assignments
- `catalogue_items` - Library catalogue
- `repository_items` - Institutional repository
- `repository_communities` - Repository communities
- `repository_collections` - Repository collections
- `loans` - Book loans
- `loan_fines` - Overdue fines
- `reservations` - Book reservations
- `announcements` - Library announcements
- `events` - Library events
- `academic_calendar` - Academic calendar
- `analytics_network` - Usage analytics

## Build & Development

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Start production
npm start

# Run tests
npm test

# Lint
npm run lint

# Docker build
docker build -t esut-smart-library .

# Docker run
docker run -p 3000:3000 esut-smart-library
```
