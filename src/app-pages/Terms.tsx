import { institutionConfig } from '@config/institution.config';
import BackButton from '@/components/BackButton';

export default function Terms() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-primary-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <BackButton />
          <p className="text-primary-300 text-sm font-medium mb-2 uppercase tracking-wider">Legal</p>
          <h1 className="text-4xl font-serif font-bold mb-3">Terms of Use</h1>
          <p className="text-primary-200 text-sm">
            Last updated: 1 January 2025&nbsp;&bull;&nbsp;{institutionConfig.name} Library
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm text-amber-800">
          By registering for or using the {institutionConfig.name} digital library platform, you agree to these Terms of Use.
          Please read them carefully. If you do not agree, do not use the platform.
        </div>

        <article className="space-y-10 text-neutral-700 leading-relaxed text-sm">
          <section id="membership">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              1. Membership Eligibility &amp; Registration
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600">
              <li>The library is open to currently enrolled students, academic staff, administrative staff, and authorised alumni of {institutionConfig.name}.</li>
              <li>You must provide accurate, complete registration information. You are responsible for keeping your account credentials confidential.</li>
              <li>Sharing login credentials with third parties is prohibited and may result in account suspension.</li>
              <li>Patron accounts are created using your institutional email address. Access is reviewed annually at the start of each academic session.</li>
              <li>The library reserves the right to suspend or terminate accounts that violate these terms without prior notice.</li>
            </ul>
          </section>

          <section id="acceptable-use">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              2. Acceptable Use Policy
            </h2>
            <p className="mb-3 text-neutral-600">You agree to use the platform only for lawful, academic, and research purposes. You must not:</p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600">
              <li>Attempt to gain unauthorised access to other patrons' accounts or restricted resources</li>
              <li>Use automated bots, scrapers, or crawlers without written permission from library management</li>
              <li>Upload malware, viruses, or malicious code of any kind</li>
              <li>Harass, impersonate, or defame other users via the community forum or comments</li>
              <li>Reproduce, redistribute, or sell licensed database content in violation of publisher agreements</li>
              <li>Submit plagiarised work to the thesis or repository portals. All submissions are subject to academic integrity checks</li>
              <li>Use the AI Reference Librarian to generate content intended for deceptive or academic dishonesty purposes</li>
            </ul>
          </section>

          <section id="loans">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              3. Loans, Renewals &amp; Fines
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="text-left p-3 border border-neutral-200 font-semibold">Patron Category</th>
                    <th className="text-left p-3 border border-neutral-200 font-semibold">Max Items</th>
                    <th className="text-left p-3 border border-neutral-200 font-semibold">Loan Period</th>
                    <th className="text-left p-3 border border-neutral-200 font-semibold">Renewals</th>
                    <th className="text-left p-3 border border-neutral-200 font-semibold">Fine (per day)</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-600">
                  {([
                    ['Undergraduate', institutionConfig.loanRules.undergraduate],
                    ['Postgraduate', institutionConfig.loanRules.postgraduate],
                    ['Academic Staff', institutionConfig.loanRules.academic_staff],
                    ['Non-Academic Staff', institutionConfig.loanRules.non_academic_staff],
                  ] as [string, { maxItems: number; durationDays: number; renewals: number }][]).map(([label, rules], i) => (
                    <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="p-3 border border-neutral-200">{label}</td>
                      <td className="p-3 border border-neutral-200">{rules.maxItems} items</td>
                      <td className="p-3 border border-neutral-200">{rules.durationDays} days</td>
                      <td className="p-3 border border-neutral-200">{rules.renewals} renewal{rules.renewals === 1 ? '' : 's'}</td>
                      <td className="p-3 border border-neutral-200">₦{institutionConfig.fineRatePerDay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc pl-5 mt-4 space-y-2 text-neutral-600">
              <li>Fines accrue from the day after the due date. Outstanding fines block further borrowing.</li>
              <li>Lost or damaged items must be replaced with the same or equivalent title, or the current market value paid.</li>
              <li>Fine disputes must be raised with the Circulation Librarian within 14 days of the fine being applied.</li>
            </ul>
          </section>

          <section id="copyright">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              4. Copyright &amp; Intellectual Property
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600">
              <li>All physical and electronic resources in the library collection are protected by copyright law. Fair use provisions under the Copyright Act (as amended) apply.</li>
              <li>You may print or download reasonable portions of licensed e-resources for personal, academic, or research use. Systematic downloading of entire journals or databases is prohibited.</li>
              <li>Photocopying is limited to one chapter or 10% of a work, whichever is less, per session, in accordance with copyright licensing.</li>
              <li>Content you upload to the platform (repository items, thesis submissions, blog comments) remains your intellectual property. By submitting, you grant the library a non-exclusive licence to store, display, and index the content.</li>
            </ul>
            <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h4 className="font-semibold text-primary-900 mb-2">Open Access Repository — CC BY 4.0</h4>
              <p className="text-primary-800 text-xs leading-relaxed">
                Items published in the {institutionConfig.name} Digital Repository are, unless otherwise stated,
                released under the{' '}
                <strong>Creative Commons Attribution 4.0 International Licence (CC BY 4.0)</strong>. This means
                anyone may share, adapt, or build upon the work provided appropriate credit is given and a link to
                the licence is provided. Authors who do not wish their work released under CC BY 4.0 must notify
                the library at the time of submission with a written justification.
              </p>
            </div>
          </section>

          <section id="repository">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              5. Thesis &amp; Repository Submission
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600">
              <li>Submissions must be the original work of the submitter. Plagiarism is a violation of academic integrity policies and may result in academic sanctions.</li>
              <li>Submissions may be checked for similarity against existing works in our system and external databases.</li>
              <li>The library reserves the right to remove or restrict access to any submission that violates copyright, institutional policy, or applicable law.</li>
              <li>Embargo periods of up to 2 years may be requested for commercially sensitive research. Requests must be approved by your faculty.</li>
            </ul>
          </section>

          <section id="licensed-databases">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              6. Licensed Databases &amp; E-Resources
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600">
              <li>Access to licensed databases is restricted to current members of {institutionConfig.name}.</li>
              <li>You must comply with each publisher's or aggregator's own terms of use.</li>
              <li>VPN or proxy access is only permitted for authenticated members accessing resources off-campus.</li>
              <li>Any abuse of database access (including automated downloading) may result in IP-level blocks affecting all users.</li>
            </ul>
          </section>

          <section id="forum">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              7. Community Forum
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600">
              <li>Forum accounts are linked to your library account via Single Sign-On (SSO).</li>
              <li>Posts must be respectful, relevant, and in compliance with the acceptable use policy above.</li>
              <li>The library moderates the forum in accordance with its community guidelines. Posts that violate guidelines may be removed without notice.</li>
              <li>Forum posts may be indexed by search engines unless posted in restricted-access categories.</li>
            </ul>
          </section>

          <section id="disclaimer">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              8. Disclaimers &amp; Limitation of Liability
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-neutral-600">
              <li>The platform is provided "as is". We make no warranty that the service will be uninterrupted, error-free, or free of viruses.</li>
              <li>AI Reference Librarian responses are generated by an AI model and may contain inaccuracies. Do not rely solely on AI outputs for academic, medical, legal, or financial decisions.</li>
              <li>The library is not liable for loss of data, loss of access, or any indirect or consequential losses arising from your use of the platform.</li>
            </ul>
          </section>

          <section id="governing-law">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              9. Governing Law
            </h2>
            <p className="text-neutral-600">
              These terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria.
              Any disputes shall be subject to the jurisdiction of the courts of Edo State.
            </p>
          </section>

          <section id="changes">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">
              10. Changes to These Terms
            </h2>
            <p className="text-neutral-600">
              We may update these Terms of Use periodically. Significant changes will be notified via the platform
              or email. Continued use of the platform after changes take effect constitutes acceptance of the revised terms.
            </p>
          </section>

          <div className="bg-neutral-100 rounded-lg p-4 text-xs text-neutral-500 text-center">
            Questions about these terms?{' '}
            <a href={`mailto:${institutionConfig.supportEmail}`} className="text-primary-600 hover:underline">
              {institutionConfig.supportEmail}
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
