import type { LibraryResource } from '@/config/libraryResources.config';

const MAROON = '#6B1D2A';

function accessBadgeClass(accessType: string): string {
  const t = accessType.toLowerCase();
  if (t.includes('institutional') || t.includes('subscription')) {
    return 'bg-primary-50 text-primary-700 border border-primary-200';
  }
  if (t === 'directory') {
    return 'bg-amber-50 text-amber-800 border border-amber-200';
  }
  if (t.includes('registration')) {
    return 'bg-sky-50 text-sky-800 border border-sky-200';
  }
  if (t.includes('free')) {
    return 'bg-neutral-100 text-neutral-700 border border-neutral-200';
  }
  return 'bg-green-50 text-green-700 border border-green-200';
}

export default function LibraryResourceCard({
  resource,
  ctaLabel = 'Access Resource',
}: {
  resource: LibraryResource;
  ctaLabel?: string;
}) {
  const initials = (resource.shortName || resource.name)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <article className="bg-white rounded-2xl border border-neutral-200 p-5 hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex items-start gap-3 mb-3">
        {resource.imageUrl ? (
          <img
            src={resource.imageUrl}
            alt=""
            className="w-10 h-10 object-contain rounded-lg border border-neutral-100 shrink-0 bg-white"
            loading="lazy"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
            }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0"
            style={{ background: MAROON }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-neutral-900 leading-tight text-sm sm:text-base">
            {resource.name}
          </h3>
          {resource.provider && (
            <p className="text-xs text-neutral-400 mt-0.5">{resource.provider}</p>
          )}
        </div>
      </div>

      {resource.description && (
        <p className="text-sm text-neutral-600 line-clamp-3 mb-3 flex-1">{resource.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accessBadgeClass(resource.accessType)}`}>
          {resource.accessType}
        </span>
        {resource.resourceType && (
          <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
            {resource.resourceType}
          </span>
        )}
      </div>

      {resource.subjects.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {resource.subjects.slice(0, 4).map((s) => (
            <span key={s} className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
              {s}
            </span>
          ))}
        </div>
      )}

      {resource.accessNote && (
        <p className="text-xs text-neutral-400 mb-3">{resource.accessNote}</p>
      )}

      <div className="mt-auto pt-3 border-t border-neutral-100">
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full block text-center text-sm py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: MAROON }}
        >
          {ctaLabel} →
        </a>
      </div>
    </article>
  );
}
