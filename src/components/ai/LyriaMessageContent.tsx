import { Fragment, ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const label = match[1] || match[3];
    const href = match[2] || match[3];
    parts.push(
      <a key={`${href}-${match.index}`} href={href} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline underline-offset-2 hover:text-primary-900">
        {label}
      </a>
    );
    lastIndex = linkPattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function cleanInline(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export default function LyriaMessageContent({ content, compact = false }: { content: string; compact?: boolean }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];
  let ordered = false;

  const flushList = () => {
    if (!list.length) return;
    const ListTag = ordered ? 'ol' : 'ul';
    blocks.push(
      <ListTag key={`list-${blocks.length}`} className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}>
        {list}
      </ListTag>
    );
    list = [];
    ordered = false;
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push(
        <p key={`heading-${index}`} className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-neutral-900 mt-2 first:mt-0`}>
          {renderInline(cleanInline(heading[2]))}
        </p>
      );
      return;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      if (list.length && ordered !== !!numbered) flushList();
      ordered = !!numbered;
      list.push(<li key={`item-${index}`}>{renderInline(cleanInline((bullet || numbered)![1]))}</li>);
      return;
    }

    flushList();
    blocks.push(
      <p key={`p-${index}`} className="mb-2 last:mb-0">
        {renderInline(cleanInline(line))}
      </p>
    );
  });

  flushList();

  return <div className="space-y-2 whitespace-normal">{blocks.map((block, index) => <Fragment key={index}>{block}</Fragment>)}</div>;
}
