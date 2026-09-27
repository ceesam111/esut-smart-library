export interface SignpostingLink {
  rel: string;
  href: string;
  type?: string;
  title?: string;
}

export function generateSignpostingLinks(input: {
  itemId: string;
  handle?: string;
  fileUrl?: string;
  metadataUrl?: string;
  citationUrl?: string;
  baseUrl?: string;
}): SignpostingLink[] {
  const base = input.baseUrl || 'https://esutlibrary.edu.ng';
  const links: SignpostingLink[] = [];

  const landingPage = input.handle
    ? `${base}/repository/${encodeURIComponent(input.handle)}`
    : `${base}/repository/${input.itemId}`;

  links.push({ rel: 'landing page', href: landingPage, type: 'text/html' });

  if (input.fileUrl) {
    links.push({ rel: 'item', href: input.fileUrl, type: 'application/pdf' });
  }

  if (input.metadataUrl) {
    links.push({ rel: 'describedby', href: input.metadataUrl, type: 'application/xml' });
  }

  if (input.citationUrl) {
    links.push({ rel: 'cite-as', href: input.citationUrl, type: 'text/html' });
  }

  links.push({ rel: 'license', href: 'https://creativecommons.org/licenses/by/4.0/', type: 'text/html' });

  return links;
}

export function signpostingToHeader(links: SignpostingLink[]): string {
  return links
    .map((link) => {
      let entry = `<${link.href}>; rel="${link.rel}"`;
      if (link.type) entry += `; type="${link.type}"`;
      if (link.title) entry += `; title="${link.title}"`;
      return entry;
    })
    .join(', ');
}

export function generateSignpostingHtml(links: SignpostingLink[]): string {
  return links
    .map((link) => {
      let tag = `<link rel="${link.rel}" href="${link.href}"`;
      if (link.type) tag += ` type="${link.type}"`;
      if (link.title) tag += ` title="${link.title}"`;
      tag += '>';
      return tag;
    })
    .join('\n');
}
