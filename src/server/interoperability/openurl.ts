export interface OpenUrlMetadata {
  genre?: string;
  aulast?: string;
  aufirst?: string;
  auinit?: string;
  title?: string;
  atitle?: string;
  btitle?: string;
  jtitle?: string;
  stitle?: string;
  date?: string;
  volume?: string;
  issue?: string;
  spage?: string;
  epage?: string;
  pages?: string;
  artnum?: string;
  issn?: string;
  eissn?: string;
  isbn?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  url?: string;
  institution?: string;
  sid?: string;
  pid?: string;
}

export function generateOpenUrl(metadata: OpenUrlMetadata, baseUrl = 'https://esutlibrary.edu.ng'): string {
  const params = new URLSearchParams();
  params.set('ctx_ver', 'Z39.88-2004');
  params.set('rft_val_fmt', 'info:ofi/fmt:kev:mtx:journal');

  if (metadata.genre) params.set('rft.genre', metadata.genre);
  if (metadata.aulast) params.set('rft.aulast', metadata.aulast);
  if (metadata.aufirst) params.set('rft.aufirst', metadata.aufirst);
  if (metadata.auinit) params.set('rft.auinit', metadata.auinit);
  if (metadata.title) params.set('rft.title', metadata.title);
  if (metadata.atitle) params.set('rft.atitle', metadata.atitle);
  if (metadata.btitle) params.set('rft.btitle', metadata.btitle);
  if (metadata.jtitle) params.set('rft.jtitle', metadata.jtitle);
  if (metadata.stitle) params.set('rft.stitle', metadata.stitle);
  if (metadata.date) params.set('rft.date', metadata.date);
  if (metadata.volume) params.set('rft.volume', metadata.volume);
  if (metadata.issue) params.set('rft.issue', metadata.issue);
  if (metadata.spage) params.set('rft.spage', metadata.spage);
  if (metadata.epage) params.set('rft.epage', metadata.epage);
  if (metadata.pages) params.set('rft.pages', metadata.pages);
  if (metadata.artnum) params.set('rft.artnum', metadata.artnum);
  if (metadata.issn) params.set('rft.issn', metadata.issn);
  if (metadata.eissn) params.set('rft.eissn', metadata.eissn);
  if (metadata.isbn) params.set('rft.isbn', metadata.isbn);
  if (metadata.doi) params.set('rft.doi', metadata.doi);
  if (metadata.pmid) params.set('rft.pmid', metadata.pmid);
  if (metadata.pmcid) params.set('rft.pmcid', metadata.pmcid);
  if (metadata.url) params.set('rft.url', metadata.url);
  if (metadata.institution) params.set('rft.institution', metadata.institution);
  if (metadata.sid) params.set('rft.sid', metadata.sid);
  if (metadata.pid) params.set('rft.pid', metadata.pid);

  return `${baseUrl}/openurl?${params.toString()}`;
}

export function parseOpenUrl(url: string): OpenUrlMetadata {
  const params = new URL(url).searchParams;
  const metadata: OpenUrlMetadata = {};

  const mappings: Record<string, keyof OpenUrlMetadata> = {
    'rft.genre': 'genre',
    'rft.aulast': 'aulast',
    'rft.aufirst': 'aufirst',
    'rft.auinit': 'auinit',
    'rft.title': 'title',
    'rft.atitle': 'atitle',
    'rft.btitle': 'btitle',
    'rft.jtitle': 'jtitle',
    'rft.stitle': 'stitle',
    'rft.date': 'date',
    'rft.volume': 'volume',
    'rft.issue': 'issue',
    'rft.spage': 'spage',
    'rft.epage': 'epage',
    'rft.pages': 'pages',
    'rft.artnum': 'artnum',
    'rft.issn': 'issn',
    'rft.eissn': 'eissn',
    'rft.isbn': 'isbn',
    'rft.doi': 'doi',
    'rft.pmid': 'pmid',
    'rft.pmcid': 'pmcid',
    'rft.url': 'url',
    'rft.institution': 'institution',
    'rft.sid': 'sid',
    'rft.pid': 'pid',
  };

  for (const [param, key] of Object.entries(mappings)) {
    const value = params.get(param);
    if (value) (metadata as Record<string, string>)[key] = value;
  }

  return metadata;
}
