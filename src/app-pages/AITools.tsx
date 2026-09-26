import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  AI_TOOLS,
  AI_TOOL_GROUPS,
  AI_TOOL_AUDIENCES,
  AI_TOOLS_SOURCE_DATE,
  type AITool,
} from '@/config/aiTools.data';

const ACCENT = '#6B1D2A';

const PRIMARY_AUDIENCES: { label: string; match: string[] }[] = [
  { label: 'Librarians', match: ['librarians', 'librarian', 'libraries', 'cataloguers', 'metadata specialists'] },
  { label: 'Researchers', match: ['researchers', 'researcher', 'systematic reviewers', 'bibliometricians'] },
  { label: 'Academic Staff', match: ['academic staff', 'lecturers', 'teaching staff'] },
  { label: 'Students', match: ['students', 'postgraduates', 'international students'] },
  { label: 'Editors', match: ['editors', 'editor'] },
  { label: 'Information Science', match: ['information scientists', 'information specialists', 'information science'] },
  { label: 'Developers', match: ['developers', 'developer', 'research software engineers', 'repository developers'] },
];

const ACCESS_CHIPS = [
  { label: 'Open Source / Open Data', match: 'Open Source / Open Data' },
  { label: 'Free', match: 'Free Service' },
  { label: 'Freemium', match: 'Freemium' },
  { label: 'Free API Tier', match: 'Free Developer Tier' },
];

const ACCESS_COLORS: Record<string, string> = {
  'Open Source / Open Data': 'bg-green-100 text-green-800 border-green-200',
  'Free Service': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Freemium: 'bg-amber-100 text-amber-800 border-amber-200',
  'Free Developer Tier': 'bg-sky-100 text-sky-800 border-sky-200',
  Conditional: 'bg-purple-100 text-purple-800 border-purple-200',
  'See details': 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

const PRIVACY_COLORS: Record<string, string> = {
  'Local / self-hostable': 'bg-green-50 text-green-700 border-green-200',
  'Institution-managed': 'bg-blue-50 text-blue-700 border-blue-200',
  'Cloud service': 'bg-neutral-50 text-neutral-600 border-neutral-200',
};

function matchesAudience(tool: AITool, chip: { match: string[] }) {
  const hay = tool.audiences.join(' | ').toLowerCase();
  return chip.match.some((m) => hay.includes(m));
}

function matchesAccess(tool: AITool, match: string) {
  if (match === 'Free Service') {
    return tool.accessBadges.includes('Free Service') || tool.accessBadges.includes('Free & Open');
  }
  return tool.accessBadges.includes(match);
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        active
          ? 'bg-primary-700 border-primary-700 text-white'
          : 'bg-white border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-700'
      }`}
    >
      {children}
    </button>
  );
}

function ToolCard({ tool, onOpen }: { tool: AITool; onOpen: (t: AITool) => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="bg-white border border-neutral-100 rounded-2xl p-5 hover:shadow-lg hover:border-primary-200 transition-all flex flex-col h-full">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-primary-50 overflow-hidden flex items-center justify-center font-bold text-primary-700 text-sm shrink-0">
          {tool.imageUrl && !imgFailed ? (
            <img
              src={tool.imageUrl}
              alt=""
              aria-hidden="true"
              className="w-6 h-6 object-contain"
              onError={() => setImgFailed(true)}
              loading="lazy"
            />
          ) : (
            tool.name.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-neutral-900 text-sm leading-tight">{tool.name}</h3>
          <p className="text-xs text-neutral-500 mt-0.5 truncate">{tool.category}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {tool.accessBadges.map((badge) => (
          <span
            key={badge}
            className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${ACCESS_COLORS[badge] ?? ACCESS_COLORS['See details']}`}
          >
            {badge}
          </span>
        ))}
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${PRIVACY_COLORS[tool.privacy] ?? PRIVACY_COLORS['Cloud service']}`}>
          {tool.privacy}
        </span>
      </div>

      <p className="text-sm text-neutral-600 leading-relaxed flex-1 line-clamp-4">{tool.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tool.audiences.slice(0, 3).map((a) => (
          <span key={a} className="text-[11px] bg-neutral-50 border border-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">
            {a}
          </span>
        ))}
        {tool.audiences.length > 3 && (
          <span className="text-[11px] text-neutral-400 px-1 py-0.5">+{tool.audiences.length - 3} more</span>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-50 flex items-center justify-between">
        <span className="text-[11px] text-neutral-400">Verified {tool.lastVerified}</span>
        <button
          type="button"
          onClick={() => onOpen(tool)}
          className="text-xs font-semibold text-primary-700 hover:underline focus:outline-none focus-visible:underline"
        >
          Details &amp; launch →
        </button>
      </div>
    </div>
  );
}

function ToolModal({ tool, onClose }: { tool: AITool; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={`${tool.name} details`}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">{tool.name}</h2>
            <p className="text-sm text-neutral-500">
              {tool.category} · <span className="text-neutral-400">{tool.group}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {tool.accessBadges.map((badge) => (
            <span key={badge} className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${ACCESS_COLORS[badge] ?? ACCESS_COLORS['See details']}`}>
              {badge}
            </span>
          ))}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${PRIVACY_COLORS[tool.privacy] ?? ''}`}>
            {tool.privacy}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium border bg-white border-neutral-200 text-neutral-600">
            {tool.accountRequired ? 'Account: free account typical' : 'No account needed for basic use'}
          </span>
        </div>

        <p className="text-sm text-neutral-700 leading-relaxed mb-5">{tool.description}</p>

        <dl className="text-sm space-y-3 mb-5">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Access</dt>
            <dd className="text-neutral-700">{tool.accessText}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Primary users</dt>
            <dd className="text-neutral-700">{tool.audiences.join(' · ')}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Integration</dt>
            <dd className="text-neutral-700">{tool.integration}</dd>
          </div>
        </dl>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800 mb-1">Library caution</p>
          <p className="text-sm text-amber-900 leading-relaxed">{tool.caution}</p>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800 mb-1">Data sensitivity</p>
          <p className="text-sm text-sky-900 leading-relaxed">
            Do not upload confidential manuscripts, personal data, restricted theses, participant data, exam
            material or licensed database PDFs into third-party AI systems unless institutional policy permits it.
            AI output can be wrong — verify against authoritative sources.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={tool.homepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-3 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: ACCENT }}
          >
            Open {tool.name} ↗
          </a>
          {tool.verificationSource && (
            <a
              href={tool.verificationSource}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-3 rounded-lg text-sm font-semibold border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Verification source ↗
            </a>
          )}
        </div>
        <p className="text-xs text-neutral-400 text-center mt-3">
          Access claim last verified {tool.lastVerified}. External link opens in a new tab.
        </p>
      </div>
    </div>
  );
}

export default function AITools() {
  usePageTitle('AI Tools');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All');
  const [audience, setAudience] = useState<string | null>(null);
  const [access, setAccess] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<string | null>(null);
  const [openTool, setOpenTool] = useState<AITool | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AI_TOOLS.filter((tool) => {
      if (group !== 'All' && tool.group !== group) return false;
      if (audience) {
        const chip = PRIMARY_AUDIENCES.find((c) => c.label === audience);
        if (chip && !matchesAudience(tool, chip)) return false;
      }
      if (access && !matchesAccess(tool, access)) return false;
      if (privacy && tool.privacy !== privacy) return false;
      if (!q) return true;
      const hay = `${tool.name} ${tool.description} ${tool.category} ${tool.group} ${tool.audiences.join(' ')} ${tool.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, group, audience, access, privacy]);

  const clearAll = () => {
    setSearch('');
    setGroup('All');
    setAudience(null);
    setAccess(null);
    setPrivacy(null);
  };

  const hasFilters = group !== 'All' || !!audience || !!access || !!privacy || !!search;

  return (
    <div>
      <div className="page-header">
        <div className="section py-14">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>AI Tools</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">AI Tools Directory</h1>
            <p className="text-white/75 text-lg leading-relaxed">
              {AI_TOOLS.length} open-access and free-tier AI tools for research, discovery, writing,
              metadata and digitisation — curated for librarians, researchers and students.
            </p>
            <p className="text-white/50 text-xs mt-2">Research verified {AI_TOOLS_SOURCE_DATE} · re-checked quarterly</p>
          </div>
        </div>
      </div>

      <div className="section py-10">
        {/* Persistent governance notices */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 flex items-start gap-3">
          <span className="text-xl shrink-0" aria-hidden="true">⚠️</span>
          <p className="text-sm text-amber-900 leading-relaxed">
            <strong>Academic integrity:</strong> AI tools can assist with discovery, reading, analysis and
            writing, but they can produce inaccurate, incomplete or fabricated output. You remain responsible
            for verifying information against authoritative sources, citing original works, protecting
            confidential data, and complying with university, funder, publisher and research-ethics rules.
            Paraphrasing does not remove the obligation to cite the original source.
          </p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 mb-8 flex items-start gap-3">
          <span className="text-xl shrink-0" aria-hidden="true">🔒</span>
          <p className="text-sm text-sky-900 leading-relaxed">
            <strong>Data sensitivity:</strong> “Free” does not mean “private”. Do not upload confidential
            manuscripts, personal data, restricted theses, participant data, exam material, unpublished grant
            proposals or licensed database PDFs into third-party AI systems unless institutional policy permits
            it. Prefer local/self-hostable tools (green badge) for sensitive material. Inclusion here means
            <em> discoverable resource</em>, not institutional endorsement.
          </p>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-5">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools, categories or audiences…"
              aria-label="Search AI tools"
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-8">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400 w-20 shrink-0">Group</span>
            <Chip active={group === 'All'} onClick={() => setGroup('All')}>All Tools</Chip>
            {AI_TOOL_GROUPS.map((g) => (
              <Chip key={g} active={group === g} onClick={() => setGroup(g)}>{g}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400 w-20 shrink-0">Audience</span>
            {PRIMARY_AUDIENCES.map((c) => (
              <Chip key={c.label} active={audience === c.label} onClick={() => setAudience(audience === c.label ? null : c.label)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400 w-20 shrink-0">Access</span>
            {ACCESS_CHIPS.map((c) => (
              <Chip key={c.label} active={access === c.match} onClick={() => setAccess(access === c.match ? null : c.match)}>
                {c.label}
              </Chip>
            ))}
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400 ml-2">Privacy</span>
            {['Local / self-hostable', 'Cloud service'].map((p) => (
              <Chip key={p} active={privacy === p} onClick={() => setPrivacy(privacy === p ? null : p)}>{p}</Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-neutral-500" aria-live="polite">
            {filtered.length} of {AI_TOOLS.length} tools
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white border border-neutral-100 rounded-2xl">
            <div className="text-5xl mb-3" aria-hidden="true">🔍</div>
            <p className="text-neutral-500 mb-4">No tools match the current filters.</p>
            <button type="button" onClick={clearAll} className="text-sm font-semibold text-primary-700 hover:underline">
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onOpen={setOpenTool} />
            ))}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600 leading-relaxed">
          <p className="font-semibold text-neutral-800 mb-1">About this directory</p>
          <p>
            Records are maintained by the library and re-verified at least quarterly. Access codes (OA-1 to
            OA-4, Conditional) follow the directory's access-status legend: OA-1 fully open, OA-2 free core
            service, OA-3 freemium, OA-4 free developer/API tier, Conditional — open under licensing, quota or
            deployment review. This is a discovery aid: systematic reviews still require reproducible database
            search strategies, protocol registration, dual screening and human risk-of-bias assessment.
          </p>
        </div>
      </div>

      {openTool && <ToolModal tool={openTool} onClose={() => setOpenTool(null)} />}
    </div>
  );
}
