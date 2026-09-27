export interface SwordServiceDocument {
  version: string;
  maxUploadSize: number;
  collection: Array<{
    href: string;
    title: string;
    accept: string[];
    acceptPackaging: string[];
    collectionPolicy?: string;
  }>;
}

export function generateSwordServiceDocument(baseUrl: string): SwordServiceDocument {
  return {
    version: '3.0',
    maxUploadSize: 104857600,
    collection: [
      {
        href: `${baseUrl}/api/sword/collection`,
        title: 'ESUT Institutional Repository',
        accept: ['application/pdf', 'application/zip', 'application/json'],
        acceptPackaging: [
          'http://purl.org/net/sword/package/SimpleZip',
          'http://purl.org/net/sword/package/METSDSpaceSIP',
        ],
        collectionPolicy: 'Open access repository for ESUT scholarly output',
      },
    ],
  };
}

export function generateSwordServiceXml(baseUrl: string): string {
  const doc = generateSwordServiceDocument(baseUrl);
  const collections = doc.collection
    .map(
      (c) => `  <collection href="${c.href}">
    <title>${c.title}</title>
    <accept>${c.accept.join('</accept><accept>')}</accept>
    <acceptPackaging>${c.acceptPackaging.join('</acceptPackaging><acceptPackaging>')}</acceptPackaging>
    <collectionPolicy>${c.collectionPolicy || ''}</collectionPolicy>
  </collection>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<service xmlns="http://purl.org/net/sword/terms/" xmlns:atom="http://www.w3.org/2005/Atom">
  <sword:version>${doc.version}</sword:version>
  <sword:maxUploadSize>${doc.maxUploadSize}</sword:maxUploadSize>
  <workspace>
    <atom:title>ESUT Library</atom:title>
${collections}
  </workspace>
</service>`;
}
