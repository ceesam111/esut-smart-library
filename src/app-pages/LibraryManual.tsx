import { useEffect, useState } from 'react';
import BackButton from '@/components/BackButton';

type Manual = { title: string; body: string; updatedAt?: string | null };

export default function LibraryManual() {
  const [manual, setManual] = useState<Manual | null>(null);

  useEffect(() => {
    fetch('/api/library-manual')
      .then((res) => res.json())
      .then((json) => setManual(json.manual))
      .catch(() => setManual({ title: 'ESUT Library Manual', body: 'Could not load the manual right now.' }));
  }, []);

  return (
    <div className="section py-10">
      <BackButton />
      <div className="max-w-3xl mx-auto card p-8">
        <h1 className="text-3xl font-serif font-semibold text-primary-900 mb-2">{manual?.title ?? 'Library Manual'}</h1>
        {manual?.updatedAt && <p className="text-xs text-neutral-400 mb-6">Updated {new Date(manual.updatedAt).toLocaleString()}</p>}
        <div className="prose prose-neutral max-w-none whitespace-pre-wrap text-neutral-700 leading-relaxed">
          {manual?.body ?? 'Loading manual...'}
        </div>
      </div>
    </div>
  );
}
