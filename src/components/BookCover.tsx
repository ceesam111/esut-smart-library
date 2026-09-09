import { useMemo, useState } from 'react';

interface BookCoverProps {
  coverImage?: string | null;
  isbn?: string | null;
  title?: string | null;
  format?: string | null;
  className?: string;
  imgClassName?: string;
  /** "card" = small icon placeholder, "detail" = larger icon placeholder */
  variant?: 'card' | 'detail';
}

/** Clean an ISBN to digits (and trailing X) only. */
function cleanIsbn(isbn?: string | null): string {
  if (!isbn) return '';
  const cleaned = isbn.replace(/[^0-9Xx]/g, '');
  return /^(?:\d{9}[\dXx]|\d{13})$/.test(cleaned) ? cleaned : '';
}

/**
 * Renders a book cover from the stored cover image, falling back to the free
 * Open Library Covers API by ISBN, then to an icon placeholder.
 * No API keys, edge functions, or tokens required — Open Library serves cover
 * images directly by URL.
 */
export default function BookCover({
  coverImage,
  isbn,
  title,
  format,
  className = 'w-full aspect-[3/4] bg-primary-50 rounded-lg flex items-center justify-center overflow-hidden',
  imgClassName = 'w-full h-full object-cover',
  variant = 'card',
}: BookCoverProps) {
  // Ordered list of cover sources to try.
  const sources = useMemo(() => {
    const list: string[] = [];
    if (coverImage) list.push(coverImage);
    const ol = cleanIsbn(isbn);
    if (ol) {
      // default=false → Open Library returns 404 (not a blank image) when no cover exists,
      // which lets onError advance to the placeholder.
      list.push(`https://covers.openlibrary.org/b/isbn/${ol}-L.jpg?default=false`);
    }
    return list;
  }, [coverImage, isbn]);

  const [idx, setIdx] = useState(0);
  const src = sources[idx];

  const iconSize = variant === 'detail' ? 'w-20 h-20' : 'w-12 h-12';
  const labelSize = variant === 'detail' ? 'text-sm' : 'text-xs mt-1';

  return (
    <div className={className}>
      {src ? (
        <img
          src={src}
          alt={title ?? 'Book cover'}
          loading="lazy"
          className={imgClassName}
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        <div className="flex flex-col items-center text-primary-200 gap-1">
          <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
          {format && <span className={`text-primary-400 font-medium ${labelSize}`}>{format}</span>}
        </div>
      )}
    </div>
  );
}
