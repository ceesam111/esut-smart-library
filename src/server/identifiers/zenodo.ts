import type { DoiProvider } from './types';

export class ZenodoDoiProvider implements DoiProvider {
  name = 'zenodo';

  isAvailable(): boolean {
    return Boolean(process.env.ZENODO_TOKEN);
  }

  async mintDoi(input: { title: string; creators: string[]; year?: number; metadata?: Record<string, unknown> }): Promise<{ doi: string; url: string } | null> {
    if (!this.isAvailable()) return null;
    try {
      const res = await fetch('https://zenodo.org/api/deposit/depositions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ZENODO_TOKEN}`,
        },
        body: JSON.stringify({
          metadata: {
            title: input.title,
            creators: input.creators.map((name) => ({ name })),
            publication_date: input.year ? `${input.year}-01-01` : new Date().toISOString().slice(0, 10),
            description: input.metadata?.abstract || '',
            upload_type: 'publication',
            publication_type: input.metadata?.item_type || 'article',
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const doi = data.metadata?.doi || data.doi;
      if (!doi) return null;
      return { doi, url: `https://doi.org/${doi}` };
    } catch {
      return null;
    }
  }
}
