import type { Metadata } from 'next';
import Page from '../page';
import { getPublicRepositoryItem } from '@/server/repository/publicItem';
import { getPublicThesis, toScholarlyThesis } from '@/server/thesis/publicThesis';
import {
  buildScholarlyJsonLd,
  buildScholarlyMetadata,
  toJsonLdHtml,
  type ScholarlyItem,
} from '@/server/seo/scholarlyMetadata';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string[] }> };

function isScholarlyPath(slug: string[] | undefined): boolean {
  if (!slug || slug.length === 0) return false;
  if (slug[0] === 'theses') return slug.length === 2;
  if (slug[0] === 'repository') {
    if (slug.length < 2) return false;
    if (slug.length === 2 && (slug[1] === 'submit' || slug[1] === 'stats')) return false;
    return true;
  }
  return false;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function resolveScholarlyItem(slug: string[]): Promise<ScholarlyItem | null> {
  if (slug[0] === 'theses') {
    const thesis = await getPublicThesis(safeDecode(slug[1]));
    return thesis ? toScholarlyThesis(thesis) : null;
  }
  const ref = slug
    .slice(1)
    .map((segment) => safeDecode(segment))
    .join('/');
  return getPublicRepositoryItem(ref);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isScholarlyPath(slug)) return {};
  const item = await resolveScholarlyItem(slug as string[]);
  if (!item) return { robots: { index: false, follow: true } };
  return buildScholarlyMetadata(item);
}

export default async function CatchAllPage({ params }: Props) {
  const { slug } = await params;
  const item = isScholarlyPath(slug) ? await resolveScholarlyItem(slug as string[]) : null;
  return (
    <>
      {item ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLdHtml(buildScholarlyJsonLd(item)) }}
        />
      ) : null}
      <Page />
    </>
  );
}
