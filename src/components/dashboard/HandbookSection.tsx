import { useAuth } from '@/hooks/useAuth';

/** Library Handbook + policy document placeholders. Shows "coming soon"
 *  until a real file is uploaded. Visible across all dashboards. */
export default function HandbookSection({ extraPolicies = [] }: { extraPolicies?: string[] }) {
  const docs = [
    { title: 'Library Handbook', icon: '📘', file: null as string | null },
    ...extraPolicies.map((p) => ({ title: p, icon: '📄', file: null as string | null })),
  ];

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
        <span>📚</span> Library Handbook &amp; Policies
      </h3>
      <div className="space-y-3">
        {docs.map((d) => (
          <div key={d.title} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-150 bg-neutral-50">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl">{d.icon}</span>
              <span className="font-medium text-neutral-800 truncate">{d.title}</span>
            </div>
            {d.file ? (
              <div className="flex gap-2 shrink-0">
                <a href={d.file} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs px-3 py-1.5">View</a>
                <a href={d.file} download className="btn-outline text-xs px-3 py-1.5">Download</a>
                <button onClick={() => window.open(d.file!, '_blank')?.print()} className="btn-outline text-xs px-3 py-1.5">Print</button>
              </div>
            ) : (
              <span className="shrink-0 text-xs text-neutral-400 italic">Coming soon</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Policy placeholders tailored to staff / researcher roles. */
export function StaffPolicies() {
  const { hasRole } = useAuth();
  const policies = hasRole('researcher_lecturer')
    ? ['Open Access Policy', 'Repository Submission Guidelines', 'Consortium Access Terms']
    : ['Staff Handbook', 'Acceptable Use Policy'];
  return <HandbookSection extraPolicies={policies} />;
}
