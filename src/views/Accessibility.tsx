import { institutionConfig } from '@config/institution.config';

export default function Accessibility() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Accessibility Statement</h1>
        <p className="text-gray-600">Our commitment to inclusive digital access</p>
      </div>

      <div className="section max-w-4xl">
        <div className="prose prose-sm max-w-none space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Commitment to Accessibility</h2>
            <p className="text-gray-700">
              {institutionConfig.name} is committed to ensuring digital accessibility for people
              with disabilities. We are continually improving the user experience for everyone and
              applying relevant accessibility standards.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">WCAG 2.1 Compliance</h2>
            <p className="text-gray-700 mb-4">
              Our digital library platform meets or exceeds the Web Content Accessibility Guidelines
              (WCAG) 2.1 Level AA standards, ensuring:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Perceivable content - accessible to users with visual and auditory impairments</li>
              <li>Operable interfaces - navigable via keyboard and other input devices</li>
              <li>Understandable text and layout - clear language and logical organization</li>
              <li>Robust design - compatible with assistive technologies and browsers</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Accessibility Features</h2>
            <p className="text-gray-700 mb-4">
              {institutionConfig.name} includes the following accessibility features:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Alt text for all images and visual content</li>
              <li>Semantic HTML structure for screen reader compatibility</li>
              <li>Full keyboard navigation without mouse required</li>
              <li>Adjustable text size and high contrast display options</li>
              <li>Captions for video content and audio transcripts</li>
              <li>Skip navigation links for efficient keyboard users</li>
              <li>Clear focus indicators for interactive elements</li>
              <li>Color not used as the only means of conveying information</li>
              <li>Accessible PDF documents with tagged content</li>
              <li>ARIA labels and landmarks for assistive technology</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Known Accessibility Issues</h2>
            <p className="text-gray-700 mb-4">
              While we strive for full accessibility, some areas may have limitations:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Older digitized documents may lack structured formatting</li>
              <li>Third-party embedded content may not fully meet WCAG standards</li>
              <li>Legacy PDF documents are being retrofitted with accessibility features</li>
              <li>Some specialized research tools have accessibility constraints</li>
            </ul>
            <p className="text-gray-700 mt-4">
              We are actively working to improve these areas. If you encounter accessibility issues,
              please report them using the contact information below.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Assistive Technology Support</h2>
            <p className="text-gray-700 mb-4">
              {institutionConfig.name} is tested and compatible with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>NVDA (NonVisual Desktop Access) - screen reader</li>
              <li>JAWS - screen reader</li>
              <li>VoiceOver - macOS and iOS screen reader</li>
              <li>TalkBack - Android screen reader</li>
              <li>ZoomText - magnification and enhancement software</li>
              <li>Dragon - speech recognition software</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Feedback and Support</h2>
            <p className="text-gray-700 mb-4">
              We welcome feedback about the accessibility of {institutionConfig.name}.
              If you experience difficulties, please contact us:
            </p>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Accessibility Support</h3>
              <p className="text-gray-700 mb-2">
                <span className="font-medium">Email:</span> accessibility@{institutionConfig.primaryDomain}
              </p>
              <p className="text-gray-700 mb-2">
                <span className="font-medium">Phone:</span> +63 (2) XXXX-XXXX (Voice/TTY)
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Office:</span> Accessibility Services<br />
                {institutionConfig.name}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Accessibility Resources</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Web Content Accessibility Guidelines (WCAG): www.w3.org/WAI/WCAG21/quickref/</li>
              <li>WebAIM: www.webaim.org</li>
              <li>Accessible Rich Internet Applications (ARIA): www.w3.org/WAI/ARIA/apg/</li>
              <li>Philippine Accessibility Law: RA 9442 - Magna Carta for Persons with Disabilities</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Continuous Improvement</h3>
            <p className="text-gray-700">
              Accessibility is an ongoing process. We are continuously evaluating and enhancing
              our digital library to ensure it remains accessible and usable for all members of
              the {institutionConfig.name} community. Your feedback helps us improve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
