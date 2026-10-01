import { useState } from 'react';
import { openThesisFile } from '@/lib/thesisFile';

interface ThesisFileButtonProps {
  thesisId: string;
  className?: string;
  label?: string;
}

/** Download button that resolves a private thesis attachment through the API. */
export default function ThesisFileButton({
  thesisId,
  className = 'btn-outline text-sm w-full text-center block',
  label = 'Download PDF',
}: ThesisFileButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setBusy(true);
    setError(null);
    try {
      await openThesisFile(thesisId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <button type="button" onClick={() => { void handleOpen(); }} disabled={busy} className={`${className} disabled:opacity-50`}>
        {busy ? 'Opening…' : label}
      </button>
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}
