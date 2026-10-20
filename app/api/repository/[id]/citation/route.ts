import { NextResponse } from 'next/server';
import { getPublicRepositoryItem } from '@/server/repository/publicItem';
import { toBibtex, toRis } from '@/server/repository/citationExport';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get('format') ?? 'bibtex';

  if (format !== 'bibtex' && format !== 'ris') {
    return NextResponse.json({ error: 'Unsupported format. Use bibtex or ris.' }, { status: 400 });
  }

  let item: Awaited<ReturnType<typeof getPublicRepositoryItem>>;
  try {
    item = await getPublicRepositoryItem(decodeURIComponent(id));
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = format === 'ris' ? toRis(item) : toBibtex(item);
  const filename = `esut-${item.id}.${format === 'ris' ? 'ris' : 'bib'}`;

  return new NextResponse(body, {
    headers: {
      'content-type': format === 'ris' ? 'application/x-research-info-systems; charset=utf-8' : 'application/x-bibtex; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
