import { institutionConfig } from '@config/institution.config';
import BackButton from '@/components/BackButton';

const tocSections = [
  { id: 'controller', heading: '1. Data Controller' },
  { id: 'data-collected', heading: '2. Data We Collect' },
  { id: 'legal-basis', heading: '3. Legal Basis for Processing' },
  { id: 'retention', heading: '4. Retention Periods' },
  { id: 'rights', heading: '5. Your Rights Under NDPA 2023' },
  { id: 'sharing', heading: '6. Data Sharing' },
  { id: 'security', heading: '7. Security Measures' },
  { id: 'cookies', heading: '8. Cookies' },
  { id: 'contact', heading: '9. Contact Us' },
];

export default function Privacy() {
  const resetCookiePreferences = () => {
    localStorage.removeItem('esut_cookie_consent');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-primary-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <BackButton />
          <p className="text-primary-300 text-sm font-medium mb-2 uppercase tracking-wider">Legal</p>
          <h1 className="text-4xl font-serif font-bold mb-3">Privacy Policy</h1>
          <p className="text-primary-200 text-sm">
            Last updated: June 2026&nbsp;&bull;&nbsp;Prepared in line with the Nigerian Data Protection Act 2023
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 flex gap-10">
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-6">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Contents</div>
            <nav className="space-y-1">
              {tocSections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-xs text-neutral-500 hover:text-primary-700 py-1 leading-snug transition-colors"
                >
                  {s.heading}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="flex-1 space-y-10 text-neutral-700 leading-relaxed text-sm">
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            This Privacy Policy explains how {institutionConfig.name} Library ("we", "us", "our") collects, uses,
            stores, and protects your personal information when you use our digital library platform. It is issued
              with reference to the <strong>Nigerian Data Protection Act 2023 (NDPA)</strong>.
          </div>

          <section id="controller" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              1. Data Controller
            </h2>
            <p>
              <strong>Data Controller:</strong> {institutionConfig.name} Library<br />
              <strong>Contact:</strong>{' '}
              <a href={`mailto:${institutionConfig.supportEmail}`} className="text-primary-600 hover:underline">
                {institutionConfig.supportEmail}
              </a>
            </p>
            <p className="mt-3">
              We are committed to protecting your personal data in accordance with the{' '}
              <strong>Nigerian Data Protection Act 2023 (NDPA)</strong> and the regulations issued by the
              Nigeria Data Protection Commission (NDPC).
            </p>
          </section>

          <section id="data-collected" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              2. Data We Collect
            </h2>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">Account &amp; Identity Data</h4>
                <ul className="list-disc pl-5 space-y-1 text-neutral-600">
                  <li>Full name, email address, phone number</li>
                  <li>Matric/staff number, faculty, department, level</li>
                  <li>Profile photograph (where provided)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">Usage &amp; Transaction Data</h4>
                <ul className="list-disc pl-5 space-y-1 text-neutral-600">
                  <li>Loan history, return dates, fine records</li>
                  <li>Interlibrary loan requests and status</li>
                  <li>Repository submissions and thesis records</li>
                  <li>Search queries and catalogue interactions</li>
                  <li>Event registrations and attendance</li>
                  <li>AI Reference Librarian conversation logs</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-neutral-800 mb-2">Technical Data</h4>
                <ul className="list-disc pl-5 space-y-1 text-neutral-600">
                  <li>IP address, browser type, device identifiers</li>
                  <li>Session data, login timestamps</li>
                  <li>Cookie preference records stored in your browser</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="legal-basis" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              3. Legal Basis for Processing
            </h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="text-left p-3 border border-neutral-200 font-semibold">Processing Activity</th>
                  <th className="text-left p-3 border border-neutral-200 font-semibold">Legal Basis (NDPA 2023)</th>
                </tr>
              </thead>
              <tbody className="text-neutral-600">
                {[
                  ['Patron account creation and authentication', 'Contractual necessity (s.25(1)(b))'],
                  ['Library loan and ILL management', 'Contractual necessity (s.25(1)(b))'],
                  ['Academic repository and thesis portal', 'Contractual necessity; Public task (s.25(1)(e))'],
                  ['Newsletter delivery', 'Consent (s.25(1)(a))'],
                  ['Usage analytics and reporting to NUC', 'Public task / Legitimate interest (s.25(1)(e),(f))'],
                  ['Security, fraud prevention, lockout', 'Legitimate interest (s.25(1)(f))'],
                  ['Account deletion requests', 'Legal obligation (s.25(1)(c))'],
                ].map(([activity, basis], i) => (
                  <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="p-3 border border-neutral-200">{activity}</td>
                    <td className="p-3 border border-neutral-200">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="retention" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              4. Retention Periods
            </h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="text-left p-3 border border-neutral-200 font-semibold">Data Type</th>
                  <th className="text-left p-3 border border-neutral-200 font-semibold">Retention Period</th>
                </tr>
              </thead>
              <tbody className="text-neutral-600">
                {[
                  ['Active patron account data', 'Duration of enrolment/employment + 2 years'],
                  ['Loan and transaction records', '5 years from last transaction'],
                  ['Repository and thesis submissions', 'Indefinitely (academic record)'],
                  ['AI Reference Librarian conversation logs', '12 months rolling'],
                  ['Security and access logs', 'Up to 12 months unless needed for an investigation'],
                  ['Newsletter consent records', 'Until withdrawn + 3 years'],
                  ['Deletion-requested accounts', '30 days post-request before erasure'],
                  ['Analytics cookies', '12 months from consent'],
                ].map(([type, period], i) => (
                  <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="p-3 border border-neutral-200">{type}</td>
                    <td className="p-3 border border-neutral-200">{period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="rights" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              5. Your Rights Under NDPA 2023
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { right: 'Right of Access (s.34)', desc: 'Request a copy of personal data we hold about you. A self-service JSON export is available via Dashboard → Settings → Download My Data; support can assist with records not included in the export.' },
                { right: 'Right to Rectification (s.35)', desc: 'Correct inaccurate or incomplete personal data via Dashboard → My Profile or by contacting us.' },
                { right: 'Right to Erasure (s.36)', desc: 'Request deletion of your account and eligible personal data via Dashboard → Settings → Delete My Account. Academic or legal records may be retained where required.' },
                { right: 'Right to Restrict Processing (s.37)', desc: 'Ask us to pause processing of your data while a dispute is resolved. Submit a request to the support email.' },
                { right: 'Right to Data Portability (s.38)', desc: 'Receive available account, circulation, request, thesis, repository, and event records in machine-readable JSON format via the Download My Data feature.' },
                { right: 'Right to Object (s.39)', desc: 'Object to processing based on legitimate interest, including direct marketing. Opt out via newsletter unsubscribe or Settings.' },
                { right: 'Right to Lodge a Complaint', desc: 'File a complaint with the Nigeria Data Protection Commission (NDPC) at ndpc.gov.ng if you believe your rights have been violated.' },
                { right: 'Automated Decisions (s.40)', desc: 'Request human review if a significant decision affecting you is made solely by automated means.' },
              ].map((item) => (
                <div key={item.right} className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <div className="font-semibold text-neutral-800 mb-1">{item.right}</div>
                  <div className="text-xs text-neutral-600 leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </section>

          <section id="sharing" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              6. Data Sharing
            </h2>
            <p>We do not sell your personal data. We may share data with:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2 text-neutral-600">
              <li><strong>Regulators and public authorities:</strong> Aggregate statistical data or legally required disclosures. No individual patron data is shared unless there is a valid legal or institutional basis.</li>
              <li><strong>Resend (email delivery):</strong> Recipient email address and message content for transactional emails only.</li>
              <li><strong>Supabase (infrastructure):</strong> Our database host. Data is stored with encryption at rest and in transit.</li>
              <li><strong>Law enforcement:</strong> Where required by a valid court order under Nigerian law.</li>
            </ul>
          </section>

          <section id="security" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              7. Security Measures
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600">
              <li>Data is transmitted over HTTPS/TLS in production</li>
              <li>Authentication is handled by Supabase Auth; passwords are not stored in application code or readable database fields</li>
              <li>Row-level security and server-side role checks protect sensitive patron, catalogue, workflow, and admin data</li>
              <li>Security middleware applies origin checks, CSRF checks for unsafe API methods, rate limits for sensitive routes, and security headers</li>
              <li>Administrative workflow actions write audit records where the production audit schema is available</li>
              <li>Hosted Supabase backups and operational controls are used for database resilience</li>
            </ul>
          </section>

          <section id="cookies" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              8. Cookies
            </h2>
            <p>You can manage your preferences at any time via the cookie banner or by clearing your browser storage.</p>
            <button
              type="button"
              onClick={resetCookiePreferences}
              className="mt-3 rounded-lg border border-primary-200 px-4 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50"
            >
              Reset cookie preferences
            </button>
            <div className="mt-4 space-y-3">
              {[
                { name: 'Essential Cookies', desc: 'Authentication tokens, session identifiers, CSRF protection. Cannot be disabled.' },
                { name: 'Analytics Cookies', desc: 'Anonymous usage data to improve the platform. Requires consent.' },
                { name: 'Marketing Cookies', desc: 'Personalise newsletter and event content. Requires consent.' },
              ].map((c) => (
                <div key={c.name} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium text-neutral-800">{c.name}:</span>{' '}
                    <span className="text-neutral-600">{c.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="contact" className="scroll-mt-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              9. Contact Us
            </h2>
            <p>To exercise any of your data rights, or with privacy enquiries, contact our Data Protection Officer:</p>
            <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="font-semibold text-neutral-800 mb-1">Data Protection Officer</div>
              <div className="text-neutral-600">{institutionConfig.name} Library</div>
              <a href={`mailto:${institutionConfig.supportEmail}`} className="text-primary-600 hover:underline">
                {institutionConfig.supportEmail}
              </a>
            </div>
            <p className="mt-4 text-neutral-500">
              We will respond to all data rights requests within <strong>30 days</strong> as required by the NDPA 2023.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
