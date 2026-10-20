import { NextResponse } from 'next/server';
import { getPublicThesis } from '@/server/thesis/publicThesis';
import { toBibtex, toRis, type CitationInput } from '@/server/repository/citationExport';

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

  let thesis: Awaited<ReturnType<typeof getPublicThesis>>;
  try {
    thesis = await getPublicThesis(decodeURIComponent(id));
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!thesis) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const citationInput: CitationInput = {
    id: thesis.id,
    handle: thesis.reference_no,
    title: thesis.title,
    authors: thesis.student_name ? [thesis.student_name] : [],
    abstract: thesis.abstract,
    keywords: thesis.keywords,
    type: thesis.submission_type,
    item_type: 'thesis',
    doi: thesis.doi,
    year: thesis.year,
    language: thesis.language,
    created_at: thesis.created_at,
    department: thesis.department,
    faculty_code: thesis.faculty,
  };
  const body = format === 'ris' ? toRis(citationInput) : toBibtex(citationInput);

  const filename = `esut-thesis-${thesis.id}.${format === 'ris' ? 'ris' : 'bib'}`;

  return new NextResponse(body, {
    headers: {
      'content-type': format === 'ris' ? 'application/x-research-info-systems; charset=utf-8' : 'application/x-bibtex; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
