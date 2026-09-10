import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ResourceType = 'book' | 'journal' | 'article' | 'ebook' | 'database' | 'thesis' | 'project' | 'newspaper' | 'unknown';

export interface Resource3DBookCardProps {
  id: string;
  title: string;
  authors?: string[] | string | null;
  resourceType?: ResourceType | string | null;
  coverUrl?: string | null;
  year?: number | string | null;
  publisher?: string | null;
  category?: string | null;
  subjects?: string[] | null;
  spineText?: string | null;
  href?: string | null;
  status?: string | null;
  confidence?: string | null;
  onClick?: () => void;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

const TYPE_LABELS: Record<ResourceType, string> = {
  book: 'BOOK',
  journal: 'JOURNAL',
  article: 'ARTICLE',
  ebook: 'EBOOK',
  database: 'DATABASE',
  thesis: 'THESIS',
  project: 'PROJECT',
  newspaper: 'NEWS',
  unknown: 'RESOURCE',
};

const TYPE_ACCENTS: Record<ResourceType, string> = {
  book: '#6B1D2A',
  journal: '#0F766E',
  article: '#7C3AED',
  ebook: '#0369A1',
  database: '#B45309',
  thesis: '#9F1239',
  project: '#166534',
  newspaper: '#334155',
  unknown: '#475569',
};

function normalizeType(value?: string | null): ResourceType {
  const lower = value?.toLowerCase().replace(/[^a-z]/g, '') || '';
  if (lower.includes('journal')) return 'journal';
  if (lower.includes('article') || lower.includes('paper')) return 'article';
  if (lower.includes('thesis') || lower.includes('dissertation')) return 'thesis';
  if (lower.includes('project') || lower.includes('essay')) return 'project';
  if (lower.includes('database')) return 'database';
  if (lower.includes('newspaper') || lower.includes('news')) return 'newspaper';
  if (lower.includes('ebook') || lower.includes('electronicbook')) return 'ebook';
  if (lower.includes('book')) return 'book';
  return 'unknown';
}

function authorsToText(authors?: string[] | string | null) {
  if (Array.isArray(authors)) return authors.filter(Boolean).slice(0, 3).join(', ');
  return authors || '';
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

export function coverGradient(seed: string, resourceType?: string | null) {
  const type = normalizeType(resourceType);
  const hash = hashString(`${seed}:${type}`);
  const hue = hash % 360;
  const hueTwo = (hue + 38 + (hash % 70)) % 360;
  const hueThree = (hue + 185) % 360;
  return {
    accent: TYPE_ACCENTS[type],
    background: `radial-gradient(circle at 22% 18%, hsla(${hueThree}, 88%, 82%, .95), transparent 28%), linear-gradient(145deg, hsl(${hue}, 72%, 38%) 0%, hsl(${hueTwo}, 76%, 48%) 52%, hsl(${hueThree}, 70%, 32%) 100%)`,
  };
}

export function ResourceTypeBadge({ resourceType }: { resourceType?: string | null }) {
  const type = normalizeType(resourceType);
  return (
    <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-900 shadow-sm ring-1 ring-black/10">
      {TYPE_LABELS[type]}
    </span>
  );
}

export function BookSpine({ text, accent }: { text: string; accent: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-y-0 left-0 z-20 w-[18%] overflow-hidden rounded-l-[1.1rem] border-r border-white/20 shadow-[inset_-10px_0_18px_rgba(0,0,0,.28)]"
      style={{ background: `linear-gradient(180deg, ${accent}, rgba(0,0,0,.72))` }}
    >
      <div className="flex h-full items-center justify-center px-1">
        <span className="max-h-[78%] overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-black uppercase tracking-[0.22em] text-white/88 [writing-mode:vertical-rl] [text-orientation:mixed]">
          {text}
        </span>
      </div>
    </div>
  );
}

export function GeneratedBookCover({ title, authors, resourceType, coverUrl, spineText, compact }: Pick<Resource3DBookCardProps, 'title' | 'authors' | 'resourceType' | 'coverUrl' | 'spineText' | 'compact'>) {
  const [imageFailed, setImageFailed] = useState(false);
  const gradient = useMemo(() => coverGradient(title || 'resource', resourceType), [title, resourceType]);
  const authorText = authorsToText(authors);
  const showImage = Boolean(coverUrl && !imageFailed);

  return (
    <div className="relative mx-auto w-full max-w-[13rem] [perspective:900px]">
      <div className="relative aspect-[3/4] origin-left rounded-[1.1rem] shadow-[0_22px_45px_rgba(15,23,42,.22)] transition duration-300 ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-y-[-5deg] motion-safe:group-hover:shadow-[0_30px_60px_rgba(15,23,42,.28)] motion-reduce:transition-none">
        <div className="absolute inset-y-[4%] -right-[6px] w-3 rounded-r-lg bg-gradient-to-r from-neutral-300 to-neutral-100 shadow-sm" aria-hidden="true" />
        <div className="absolute inset-0 overflow-hidden rounded-[1.1rem] border border-white/35 bg-neutral-200" style={showImage ? undefined : { background: gradient.background }}>
          {showImage && <img src={coverUrl!} alt="" onError={() => setImageFailed(true)} className="h-full w-full object-cover" loading="lazy" />}
          <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(255,255,255,.28)_0%,rgba(255,255,255,.06)_32%,rgba(0,0,0,.16)_100%)]" aria-hidden="true" />
          <BookSpine text={spineText || title} accent={gradient.accent} />
          <div className="relative z-30 flex h-full flex-col items-center justify-between pl-[22%] pr-[7%] py-[9%] text-center text-white drop-shadow-sm">
            <ResourceTypeBadge resourceType={resourceType} />
            <div className="min-w-0 space-y-2 w-full overflow-hidden">
              <h3 className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} max-w-full font-black leading-tight line-clamp-4 break-words whitespace-normal [hyphens:auto]`}>{title}</h3>
              {authorText && <p className="max-w-full text-[11px] font-semibold leading-snug text-white/82 line-clamp-2 break-words whitespace-normal overflow-hidden [hyphens:auto]">{authorText}</p>}
            </div>
            <div className="h-7 w-16 rounded-full bg-white/18 ring-1 ring-white/25" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Resource3DBookCard(props: Resource3DBookCardProps) {
  const authorText = authorsToText(props.authors);
  const type = normalizeType(props.resourceType);
  const label = `${props.title}${authorText ? ` by ${authorText}` : ''}${props.year ? `, ${props.year}` : ''}`;
  const statusText = [props.status, props.confidence].filter(Boolean).join(' · ');

  const body = (
    <>
      <GeneratedBookCover title={props.title} authors={props.authors} resourceType={type} coverUrl={props.coverUrl} spineText={props.spineText} compact={props.compact} />
      <div className="mt-4 min-w-0 text-center overflow-hidden">
        <h3 className="text-sm font-bold leading-snug text-neutral-900 line-clamp-2 break-words [hyphens:auto] group-hover:text-primary-700">{props.title}</h3>
        {authorText && <p className="mt-1 text-xs text-neutral-500 line-clamp-1 break-words [hyphens:auto]">{authorText}</p>}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-neutral-500">
          {props.year && <span>{props.year}</span>}
          {props.publisher && <span className="line-clamp-1 max-w-[120px]">{props.publisher}</span>}
          {props.category && <span>{props.category}</span>}
        </div>
        {props.subjects?.length ? <p className="mx-auto mt-1 max-w-[14rem] text-[11px] text-neutral-400 line-clamp-1">{props.subjects.slice(0, 3).join(' · ')}</p> : null}
        {statusText && <span className="mt-2 inline-flex rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700">{statusText}</span>}
      </div>
      {props.actions && <div className="mt-3 flex flex-wrap justify-center gap-2">{props.actions}</div>}
    </>
  );

  const className = `group block rounded-2xl p-3 outline-none transition focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 motion-reduce:transition-none ${props.className || ''}`;
  if (props.href) {
    if (props.href.startsWith('/')) return <Link to={props.href} aria-label={label} onClick={props.onClick} className={className}>{body}</Link>;
    return <a href={props.href} target="_blank" rel="noopener noreferrer" aria-label={label} onClick={props.onClick} className={className}>{body}</a>;
  }
  if (props.onClick) return <button type="button" aria-label={label} onClick={props.onClick} className={`${className} w-full text-left`}>{body}</button>;
  return <div aria-label={label} className={className}>{body}</div>;
}

export function Resource3DBookCardSkeleton() {
  return (
    <div className="rounded-2xl p-3 animate-pulse">
      <div className="mx-auto aspect-[3/4] max-w-[13rem] rounded-[1.1rem] bg-neutral-200 shadow-[0_18px_35px_rgba(15,23,42,.12)]" />
      <div className="mx-auto mt-4 h-3.5 w-3/4 rounded bg-neutral-200" />
      <div className="mx-auto mt-2 h-3 w-1/2 rounded bg-neutral-100" />
    </div>
  );
}

export function Resource3DBookGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${className || ''}`}>{children}</div>;
}
