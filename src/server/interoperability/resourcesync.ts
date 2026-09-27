export interface ResourceSyncCapability {
  capability: string;
  uri: string;
  description?: string;
}

export function generateCapabilityList(baseUrl: string): ResourceSyncCapability[] {
  return [
    {
      capability: 'resourcelist',
      uri: `${baseUrl}/.well-known/resourcesync/resourcelist.xml`,
      description: 'List of all repository resources',
    },
    {
      capability: 'changelist',
      uri: `${baseUrl}/.well-known/resourcesync/changelist.xml`,
      description: 'List of recent changes',
    },
    {
      capability: 'capabilitylist',
      uri: `${baseUrl}/.well-known/resourcesync/capabilitylist.xml`,
      description: 'This capability list',
    },
  ];
}

export function generateCapabilityListXml(baseUrl: string): string {
  const capabilities = generateCapabilityList(baseUrl);
  const entries = capabilities
    .map(
      (c) => `  <url>
    <loc>${c.uri}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <rs:md capability="${c.capability}"${c.description ? ` description="${c.description}"` : ''}/>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:rs="http://www.openarchives.org/rs/2.0">
  <rs:ln rel="up" href="${baseUrl}/.well-known/resourcesync/source-description.xml"/>
${entries}
</urlset>`;
}

export function generateSourceDescriptionXml(baseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:rs="http://www.openarchives.org/rs/2.0">
  <rs:ln rel="self" href="${baseUrl}/.well-known/resourcesync/source-description.xml"/>
  <rs:md capability="description"/>
  <url>
    <loc>${baseUrl}/.well-known/resourcesync/capabilitylist.xml</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <rs:md capability="capabilitylist"/>
  </url>
</urlset>`;
}

export function generateResourceListXml(baseUrl: string, resources: Array<{ id: string; handle?: string; updated_at: string }>): string {
  const entries = resources
    .map((r) => {
      const uri = r.handle
        ? `${baseUrl}/repository/${encodeURIComponent(r.handle)}`
        : `${baseUrl}/repository/${r.id}`;
      return `  <url>
    <loc>${uri}</loc>
    <lastmod>${r.updated_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)}</lastmod>
    <rs:md capability="resource" hash="sha-256:${r.id}"/>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:rs="http://www.openarchives.org/rs/2.0">
  <rs:ln rel="up" href="${baseUrl}/.well-known/resourcesync/capabilitylist.xml"/>
${entries}
</urlset>`;
}
