# TypeScript Burndown — ESUT Smart Library

## Starting State

- **Total errors:** 65
- **Root causes:** 4

## Root Causes

### 1. `as const` on `libraryMode` (line 73)

`libraryMode: "single" as const` narrowed the type to the literal `"single"`, making comparisons with `"multi"` fail with TS2367.

**Fix:** Changed to `as string`.

**Errors resolved:** ~20

### 2. `as const` on `itemVisibility.options` (line 77)

`options: ["global", "public", "private"] as const` narrowed the array to a readonly tuple of literals.

**Fix:** Changed to `as string[]`.

**Errors resolved:** ~20

### 3. Empty arrays inferred as `never[]`

`branchLibraries: []` and `facultyLibraries: []` were inferred as `never[]`, causing `.map()` callbacks to receive `never` type.

**Fix:** Added explicit type annotations:
```typescript
branchLibraries: [] as Array<{ name: string; slug: string; code: string; description: string }>,
facultyLibraries: [] as Array<{ name: string; slug: string; code: string; description: string }>,
```

**Errors resolved:** ~20

### 4. Miscellaneous (3 errors)

- `ringColor` CSS property in `Team.tsx` — removed (not a valid CSS property)
- `request.ip` in `middleware.ts` — removed (doesn't exist on NextRequest in Next.js 16)
- `department` field in `secureDownload.ts` — added to select (from Batch 1 changes)

**Errors resolved:** 3

## Ending State

- **Total errors:** 0
- **All errors fixed at root cause level**
- **No `as any`, no `@ts-ignore`, no type suppression used**
