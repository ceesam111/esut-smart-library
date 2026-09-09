# 3D Resource Cards

The shared 3D resource card system lives in `src/components/resource/Resource3DBookCard.tsx`.

## Components

- `Resource3DBookCard`: complete accessible card with cover, metadata, status, and actions.
- `Resource3DBookGrid`: responsive grid wrapper.
- `GeneratedBookCover`: CSS-only 3D book/article cover.
- `BookSpine`: vertical spine label.
- `ResourceTypeBadge`: cover label such as `BOOK`, `ARTICLE`, or `THESIS`.
- `Resource3DBookCardSkeleton`: loading skeleton.

## Visual Rules

- Uses CSS-only depth: spine, page edge, cover highlight, soft shadow, and hover lift.
- Uses a real cover image when `coverUrl` is provided.
- Falls back to a deterministic gradient based on title and resource type.
- Spine text is vertical and truncated.
- Hover/tap motion respects `prefers-reduced-motion` through Tailwind `motion-safe` and `motion-reduce` classes.

## Accessibility

- Internal `href` values render React Router `Link`.
- External `href` values render safe external anchors.
- Cards receive descriptive `aria-label` text.
- Status and confidence are rendered as text, not color-only indicators.
- If action buttons are supplied without `href`, the card renders as a non-interactive container to avoid nested interactive controls.

## Integrated Pages

- Catalogue local collection grid.
- Catalogue free ebook results.
- Digital repository result grid.
- Global search results and external discovery cards.
- Admin harvest candidate previews.

## Example

```tsx
<Resource3DBookCard
  id={item.id}
  title={item.title}
  authors={item.authors}
  resourceType="book"
  coverUrl={item.cover_image}
  year={item.year}
  publisher={item.publisher}
  subjects={item.subjects}
  spineText={item.call_number || item.isbn}
  href={`/catalogue/${item.id}`}
  status="Available"
/>
```

Use `actions` for source badges, approval controls, download links, or request-review buttons.
