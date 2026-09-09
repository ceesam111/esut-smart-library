import { useState } from 'react';

const FAQS = [
  {
    q: 'How do I register for a library account?',
    a: 'Visit /register, choose the correct account type, fill in your details, and submit. All new registrations wait for library approval before dashboard access, resource requests, or a digital library card become available.',
  },
  {
    q: 'How do I access library resources from home?',
    a: 'Log in at esutlibrary.edu.ng from any device. Open access items are available without login. Licensed resources require your library account. Install the ESUT Library app from your browser for offline access by clicking "Add to Home Screen" when prompted.',
  },
  {
    q: 'How do I borrow a physical book?',
    a: 'Visit any ESUT Library location with your digital library card at /dashboard/library-card. Library staff can use the circulation and barcode tools to process checkout records and due dates.',
  },
  {
    q: 'How many books can I borrow at once?',
    a: 'Students (undergraduate): 4 items for 14 days. Postgraduate students: 8 items for 30 days. Academic staff: 20 items for 90 days. Non-academic staff: 6 items for 21 days. All categories may renew loans up to the permitted number of renewals.',
  },
  {
    q: 'What happens if I return a book late?',
    a: 'Overdue items may attract fines based on library circulation rules configured by staff. You can view loan status in your dashboard and resolve fines or overdue issues at the circulation desk or by contacting a librarian.',
  },
  {
    q: 'How do I submit my thesis or project?',
    a: 'Visit /thesis/submit while logged in with your student account. Upload your PDF, fill in the required fields including title, abstract, supervisor, and keywords, and submit. Staff can review submissions before repository publication. DOI fields are supported where an identifier is assigned, but DOI minting is not automatic for every submission.',
  },
  {
    q: 'What is Lexis and how does she help me?',
    a: 'Lexis is the ESUT Library AI Reference Librarian powered through the configured AI gateway. She helps you find resources, draft citations in common styles, answer questions about library services, and guide literature searches. Access her via the floating green button or visit /ai-librarian for the full-page experience.',
  },
  {
    q: 'How do I access course reading lists?',
    a: 'Log in and visit /dashboard/course-reserves. Course reserve and reading-list features are available where they have been configured by library staff or lecturers for your department or faculty.',
  },
  {
    q: 'Can external readers access the library?',
    a: 'External readers can access open-access resources online without login. Guest or external-reader account access depends on the library policy configured by administrators; contact the circulation desk for borrowing or in-person access details.',
  },
  {
    q: 'How do I request a book the library does not have?',
    a: 'Use the Resource Request form at /dashboard/requests. The request is sent to the library review queue for staff action. For urgent academic needs, contact a librarian directly after submitting the request.',
  },
  {
    q: 'How do I access open access journals and ebooks?',
    a: 'Visit /databases for curated free academic resources and use /search/global for local catalogue search plus external discovery where configured. The catalogue and global search pages include open-access and ebook-oriented discovery paths.',
  },
  {
    q: 'How do I report a technical problem with the library platform?',
    a: 'Email library@esut.edu.ng or use the contact options at /contact. Include the page, what you were trying to do, and your device/browser. The library team will review and prioritise reported issues.',
  },
];

function FAQItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-neutral-200 ${idx === 0 ? 'border-t' : ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 text-left py-5 group"
      >
        <span className="font-medium text-neutral-900 group-hover:text-primary-700 transition-colors text-sm md:text-base">
          {q}
        </span>
        <span className="text-neutral-400 text-xl shrink-0">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="pb-5 pr-8">
          <p className="text-neutral-600 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="pt-20" style={{ background: '#1A4731' }}>
        <div className="max-w-4xl mx-auto px-6 py-14 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Frequently Asked Questions</h1>
          <p className="text-lg text-white/80">Everything you need to know about using ESUT Smart Library.</p>
        </div>
      </div>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div>
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} idx={i} />
            ))}
          </div>

          <div className="mt-12 p-6 rounded-2xl text-center" style={{ background: '#f0f9f4' }}>
            <p className="font-semibold text-neutral-900 mb-2">Still have questions?</p>
            <p className="text-sm text-neutral-600 mb-4">
              Contact our librarians directly — we aim to respond within 2 working days.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a
                href="mailto:library@esut.edu.ng"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: '#1A4731' }}
              >
                Email Us
              </a>
              <a
                href="https://wa.me/2347030162879"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
