import { institutionConfig } from '@config/institution.config';

export default function Terms() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Terms of Use</h1>
        <p className="text-gray-600">Guidelines for using {institutionConfig.name}</p>
      </div>

      <div className="section max-w-4xl">
        <div className="prose prose-sm max-w-none space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Membership Terms</h2>
            <p className="text-gray-700 mb-4">
              Access to {institutionConfig.name} is available to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Current faculty and staff members of {institutionConfig.name}</li>
              <li>Registered students of {institutionConfig.name}</li>
              <li>Alumni members with active alumni accounts</li>
              <li>Visiting scholars and researchers with institutional affiliation</li>
              <li>Authorized external users with institutional approval</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Membership privileges are granted upon verification of institutional affiliation and
              may be revoked if affiliation is terminated or terms of use are violated.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceptable Use Policy</h2>
            <p className="text-gray-700 mb-4">
              Users agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Share login credentials or account access with unauthorized persons</li>
              <li>Systematically download, mirror, or mass extract content</li>
              <li>Use the service for commercial purposes without authorization</li>
              <li>Engage in harassment, abuse, or threatening behavior</li>
              <li>Circumvent access controls or security measures</li>
              <li>Engage in illegal activities or violation of intellectual property rights</li>
              <li>Distribute malware or attempt unauthorized system access</li>
              <li>Interfere with service operation or other users' access</li>
              <li>Infringe on privacy or confidentiality of others</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Violations may result in account suspension, access revocation, and referral to
              appropriate authorities.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Intellectual Property Statement</h2>
            <p className="text-gray-700 mb-4">
              {institutionConfig.name} respects intellectual property rights:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Content in the digital library is protected by copyright law</li>
              <li>Permission is required before reproducing, distributing, or modifying content</li>
              <li>Fair use provisions permit limited copying for personal, educational use</li>
              <li>Attribution and citations must acknowledge original authors and sources</li>
              <li>Users may not claim authorship of materials they did not create</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Content creators retain all intellectual property rights to their contributions.
              {institutionConfig.name} operates under open access and creative commons principles
              where applicable.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Default License</h2>
            <p className="text-gray-700 mb-4">
              Unless otherwise specified, all user-contributed content to {institutionConfig.name}
              is licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).
            </p>
            <p className="text-gray-700 mb-4">
              Under CC BY 4.0, others may:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Share and adapt your work for any purpose</li>
              <li>Use the content commercially</li>
              <li>Distribute modified versions</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Provided they give appropriate attribution and indicate any modifications made.
              View the full CC BY 4.0 license at creativecommons.org/licenses/by/4.0/.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              {institutionConfig.name} and its operators provide the service "as is" without warranties
              of any kind. We are not liable for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Loss of data or service interruptions</li>
              <li>Unauthorized access due to user negligence</li>
              <li>Indirect or consequential damages</li>
              <li>Third-party content or external links</li>
              <li>Accuracy of user-contributed information</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Modifications to Terms</h2>
            <p className="text-gray-700">
              {institutionConfig.name} reserves the right to modify these terms at any time. Changes
              will be posted with an updated effective date. Continued use constitutes acceptance
              of the updated terms.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Acknowledgment</h3>
            <p className="text-gray-700">
              By using {institutionConfig.name}, you acknowledge that you have read, understood,
              and agree to be bound by these Terms of Use. If you do not agree with any part of
              these terms, you should not use the service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
