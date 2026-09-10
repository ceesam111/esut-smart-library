import { institutionConfig } from '@config/institution.config';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Link } from 'react-router-dom';

const GREEN = '#6B1D2A';
const GOLD  = '#D4A017';

const FEATURES = [
  'Text alternatives are provided for core interface imagery and decorative graphics are hidden where practical',
  'Semantic HTML structure is used for headings, navigation, forms, tables, and page regions',
  'Core navigation, forms, search, dashboard actions, and catalogue workflows are designed for keyboard operation',
  'Responsive layouts support browser zoom and mobile text scaling without requiring a separate text-size widget',
  'Skip navigation link is provided for keyboard users',
  'Clear focus indicators for interactive elements',
  'Statuses and alerts use text labels in addition to colour where possible',
  'ARIA labels and landmarks are used for key controls such as menus, search, voice controls, and floating actions',
];

const KNOWN_ISSUES = [
  'A full third-party WCAG audit has not yet been completed',
  'The app does not currently include a built-in high-contrast or text-size toggle; users should use browser or operating-system controls',
  'Uploaded PDFs and third-party documents may not have tagged structure or accessible reading order',
  'Older digitised documents may lack structured formatting',
  'Third-party content and external publisher websites may not fully meet WCAG standards',
  'Some specialised research tools have accessibility constraints',
];

const SUPPORTED_TOOLS = [
  { name: 'Screen readers', desc: 'The interface is built with semantic HTML and ARIA labels to support tools such as NVDA, JAWS, VoiceOver, and TalkBack.' },
  { name: 'Keyboard-only navigation', desc: 'Interactive controls are reachable by keyboard and visible focus styles are preserved.' },
  { name: 'Browser zoom and OS scaling', desc: 'Responsive layouts are intended to remain usable at common browser zoom and mobile text scaling levels.' },
  { name: 'Speech and dictation tools', desc: 'Standard form controls are used where practical so operating-system dictation tools can enter text.' },
];

export default function Accessibility() {
  usePageTitle('Accessibility Statement');

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="section py-12">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>Accessibility</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Accessibility Statement</h1>
            <p className="text-white/75 text-lg leading-relaxed">
              Our commitment to inclusive digital access for the entire university community.
            </p>
          </div>
        </div>
      </div>

      <div className="section py-12">
        <div className="max-w-4xl space-y-10">

          {/* Commitment */}
          <section className="bg-white rounded-xl border border-neutral-100 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white text-xl" style={{ background: GREEN }}>
                ✓
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 mb-2">Commitment to Accessibility</h2>
                <p className="text-neutral-600 leading-relaxed">
                  {institutionConfig.name} is committed to ensuring digital accessibility for people
                  with disabilities. We are continually improving the user experience for everyone and
                  working toward the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards —
                  making content more perceivable, operable, understandable, and robust over time.
                </p>
              </div>
            </div>
          </section>

          {/* Features grid */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Accessibility Features</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-3 bg-white border border-neutral-100 rounded-lg p-4">
                  <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: GREEN }}>✓</span>
                  <span className="text-sm text-neutral-700">{f}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Assistive technology */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Assistive Technology Support</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SUPPORTED_TOOLS.map((tool) => (
                <div key={tool.name} className="bg-white border border-neutral-100 rounded-xl p-5">
                  <h3 className="font-semibold text-neutral-900 mb-1">{tool.name}</h3>
                  <p className="text-sm text-neutral-500">{tool.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Known issues */}
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-amber-900 mb-3">Known Limitations</h2>
            <p className="text-sm text-amber-800 mb-3">
              While we strive for full compliance, some areas have known limitations we are actively addressing:
            </p>
            <ul className="space-y-2">
              {KNOWN_ISSUES.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                  <span className="mt-0.5 shrink-0">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          </section>

          {/* Contact */}
          <section className="rounded-xl p-8 text-white" style={{ background: GREEN }}>
            <h2 className="text-xl font-bold mb-2">Report an Accessibility Issue</h2>
            <p className="text-white/80 mb-5 text-sm leading-relaxed">
              We welcome feedback about the accessibility of {institutionConfig.shortName} Library.
              If you encounter barriers, please contact us and we will work to resolve them promptly.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <a
                href={`mailto:accessibility@${institutionConfig.primaryDomain}`}
                className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-3 transition-colors"
              >
                <span className="text-xl">✉</span>
                <div>
                  <div className="text-xs text-white/60 font-medium">Email</div>
                  <div className="text-sm font-semibold">accessibility@{institutionConfig.primaryDomain}</div>
                </div>
              </a>
              <a
                href={`tel:${institutionConfig.contactPhone}`}
                className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-3 transition-colors"
              >
                <span className="text-xl">📞</span>
                <div>
                  <div className="text-xs text-white/60 font-medium">Phone</div>
                  <div className="text-sm font-semibold">{institutionConfig.contactPhone}</div>
                </div>
              </a>
            </div>
            <p className="text-white/60 text-xs mt-5">
              We aim to acknowledge accessibility feedback within 2 business days.
              Formal complaints may be escalated to the{' '}
              <span className="text-white/80">Disability Rights Commission of Nigeria</span>.
            </p>
          </section>

          {/* Resources */}
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Accessibility Resources</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { name: 'WCAG 2.1 Guidelines', url: 'https://www.w3.org/WAI/WCAG21/quickref/', desc: 'W3C Web Content Accessibility Guidelines' },
                { name: 'WebAIM', url: 'https://webaim.org', desc: 'Web Accessibility in Mind — tools and training' },
                { name: 'ARIA Authoring Practices', url: 'https://www.w3.org/WAI/ARIA/apg/', desc: 'Accessible Rich Internet Applications guide' },
                { name: 'Disability Rights Commission Nigeria', url: 'https://drcn.gov.ng', desc: 'Federal agency for disability rights' },
              ].map((r) => (
                <a
                  key={r.name}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 bg-white border border-neutral-100 hover:border-primary-300 rounded-lg p-4 transition-colors group"
                >
                  <span className="text-lg mt-0.5">🔗</span>
                  <div>
                    <div className="font-semibold text-sm text-neutral-900 group-hover:underline">{r.name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{r.desc}</div>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <div className="text-sm text-neutral-400 text-center pb-4">
            Last reviewed: June 2026 · {institutionConfig.name}
          </div>
        </div>
      </div>
    </div>
  );
}
