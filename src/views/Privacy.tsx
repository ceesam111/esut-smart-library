import { institutionConfig } from '@config/institution.config';

export default function Privacy() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Privacy Policy</h1>
        <p className="text-gray-600">How we collect, use, and protect your data</p>
      </div>

      <div className="section max-w-4xl">
        <div className="prose prose-sm max-w-none space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Collected</h2>
            <p className="text-gray-700 mb-4">
              {institutionConfig.name} collects the following information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Personal identification information (name, email, institution ID)</li>
              <li>Academic records and affiliation details</li>
              <li>Reading list and borrowing history</li>
              <li>Search queries and resource access patterns</li>
              <li>Device information and usage analytics</li>
              <li>Research interests and profile information (if provided)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Purpose of Collection</h2>
            <p className="text-gray-700 mb-4">
              We collect and process your data for these purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Providing and improving digital library services</li>
              <li>Personalizing your experience and recommendations</li>
              <li>Authentication and account management</li>
              <li>Generating usage statistics and research analytics</li>
              <li>Communicating important updates and notifications</li>
              <li>Ensuring service security and preventing misuse</li>
              <li>Complying with legal and institutional requirements</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We retain your data according to the following retention periods:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Personal account information: Retained for the duration of your affiliation plus 5 years</li>
              <li>Borrowing and transaction records: Retained for 3 years</li>
              <li>Access logs and analytics: Retained for 2 years</li>
              <li>Usage data: Aggregated and anonymized after 1 year</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Patron Rights Under NDPA 2023</h2>
            <p className="text-gray-700 mb-4">
              In compliance with the National Data Privacy Act of 2023, patrons have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Access and review their personal data held by {institutionConfig.name}</li>
              <li>Request correction of inaccurate or incomplete data</li>
              <li>Request deletion of data, subject to legal retention requirements</li>
              <li>Withdraw consent for data processing</li>
              <li>File a complaint with the National Privacy Commission (NPC)</li>
              <li>Request information about how their data is being used</li>
              <li>Restrict the use of their data for marketing or profiling purposes</li>
            </ul>
            <p className="text-gray-700 mt-4">
              To exercise these rights, please contact our Data Privacy Officer at privacy@{institutionConfig.primaryDomain}.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Sovereignty</h2>
            <p className="text-gray-700 mb-4">
              {institutionConfig.name} commits to data sovereignty principles:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Personal data of Philippine residents is stored within Philippine jurisdiction</li>
              <li>International data transfers comply with NDPA requirements</li>
              <li>Third-party service providers are subject to data processing agreements</li>
              <li>No data is sold to commercial entities without explicit consent</li>
              <li>Regular security audits ensure data protection standards are maintained</li>
            </ul>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Privacy Officer</h3>
            <p className="text-gray-700">
              For privacy-related inquiries, contact our Data Privacy Officer:
            </p>
            <p className="text-gray-700 mt-2">
              Email: privacy@{institutionConfig.primaryDomain}<br />
              Phone: +63 (2) XXXX-XXXX<br />
              Office: {institutionConfig.name}
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Policy Updates</h3>
            <p className="text-gray-700">
              This privacy policy is effective as of the date shown and may be updated periodically.
              Changes will be posted on this page with an updated effective date. Continued use of the
              service constitutes acceptance of the updated policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
