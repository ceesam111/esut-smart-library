# Quality Gates — ESUT Smart Library

## Expected Healthy State

| Gate | Target |
|---|---|
| TypeScript errors | 0 |
| Lint errors | 0 |
| Tests failed | 0 |
| Build exit code | 0 |
| Critical npm vulnerabilities | 0 |

## Local Developer Commands

```bash
# Install dependencies
npm ci

# TypeScript check
npm run typecheck

# Lint
npm run lint

# Run all tests
npm test

# Production build
npm run build
```

## CI Requirements

CI pipeline (`.github/workflows/ci.yml`) enforces:

1. TypeScript (`tsc --noEmit`) — must pass
2. Lint (`eslint . --max-warnings=0`) — must pass
3. Vitest (`vitest run`) — must pass
4. Production build (`next build`) — must pass
5. Security audit (`npm audit --omit=dev --audit-level=critical`) — must pass

No `continue-on-error` on any gate. No `|| true`. No suppressed failures.
