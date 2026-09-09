import { useState } from 'react';
import { Link } from 'react-router-dom';

type TabId = 'patrons' | 'staff';

const PATRON_STEPS = [
  {
    n: 1,
    title: 'Create Your Account',
    icon: '📝',
    desc: 'Visit /register and fill in your details. Students need their matriculation number; staff need their employee ID. Select your faculty and preferred home library.',
    link: '/register',
    linkLabel: 'Register Now',
  },
  {
    n: 2,
    title: 'Get Your Digital Library Card',
    icon: '💳',
    desc: 'After logging in, visit /dashboard/library-card to view your digital library card with QR code. Show this to any ESUT librarian to borrow physical books.',
    link: '/dashboard/library-card',
    linkLabel: 'My Library Card',
  },
  {
    n: 3,
    title: 'Search the Catalogue',
    icon: '🔍',
    desc: 'Visit /catalogue to browse over 12,000 titles. Filter by subject, format, faculty library, or year. Click any item to see full details, availability, and location. Use the search bar for keyword searches.',
    link: '/catalogue',
    linkLabel: 'Browse Catalogue',
  },
  {
    n: 4,
    title: 'Access Open Access Resources',
    icon: '🌐',
    desc: 'Visit /databases to access thousands of free academic resources including Project Gutenberg, Open Library, OAPEN, DOAB, CORE, and over 20,000 DOAJ journals. No subscription required.',
    link: '/databases',
    linkLabel: 'Browse Databases',
  },
  {
    n: 5,
    title: 'Ask Lexis for Research Help',
    icon: '🤖',
    desc: 'Click the green floating button (bottom-right of any page) to chat with Lexis, the ESUT AI Reference Librarian. Ask her to find resources, generate citations, explain concepts, or guide your literature review.',
    link: '/ai-librarian',
    linkLabel: 'Open Lexis',
  },
  {
    n: 6,
    title: 'Manage Your Loans',
    icon: '📚',
    desc: 'Visit /dashboard/loans to see all your active loans, due dates, and renewals remaining. You can renew eligible items online up to the permitted number of times. Overdue items show clearly with fine information.',
    link: '/dashboard/loans',
    linkLabel: 'My Loans',
  },
  {
    n: 7,
    title: 'Access Your Course Reading Lists',
    icon: '📋',
    desc: 'Visit /dashboard/course-reserves to see reading lists set by your lecturers for each enrolled course. Items marked "Required" should be read for your next class. Click any item to see its location or download link.',
    link: '/dashboard/course-reserves',
    linkLabel: 'Course Reading Lists',
  },
  {
    n: 8,
    title: 'Submit a Thesis or Project',
    icon: '🎓',
    desc: 'Final year and postgraduate students can submit work digitally at /thesis/submit. Upload your PDF, fill in metadata, and submit for supervisor review. Approved works can be published in the repository; DOI fields are supported where an identifier is assigned.',
    link: '/thesis/submit',
    linkLabel: 'Submit Thesis',
  },
];

const STAFF_STEPS = [
  {
    n: 1,
    title: 'Access the Admin Dashboard',
    icon: '⚙️',
    desc: 'Log in with your librarian account and visit /admin. You will see live statistics on catalogue items, patrons, loans, and pending submissions. Quick action buttons let you jump to any management section.',
    link: '/admin',
    linkLabel: 'Admin Dashboard',
  },
  {
    n: 2,
    title: 'Add Items to the Catalogue',
    icon: '📖',
    desc: 'Visit /admin/catalogue/new to add a new catalogue item. Fill in MARC21 fields including title, authors, ISBN, subject headings, and physical location. Use /admin/catalogue/scan to scan ISBN barcodes with your phone camera for automatic metadata lookup.',
    link: '/admin/catalogue/new',
    linkLabel: 'Add Catalogue Item',
  },
  {
    n: 3,
    title: 'Manage Patron Loans',
    icon: '🔄',
    desc: 'Visit /admin/circulation for the full circulation desk interface. Check out items to patrons by searching their patron ID and scanning the item barcode. Check in returned items, calculate fines, and manage holds queues.',
    link: '/admin/circulation',
    linkLabel: 'Circulation Desk',
  },
  {
    n: 4,
    title: 'Process Repository Submissions',
    icon: '📂',
    desc: 'Visit /admin/repository to review all pending submissions. Each submission shows the full metadata, uploaded PDF, plagiarism report, and supervisor approval status. Approve or reject with a comment. Approved items are automatically published.',
    link: '/admin/repository',
    linkLabel: 'Repository Queue',
  },
  {
    n: 5,
    title: 'Generate Regulatory Reports',
    icon: '📊',
    desc: 'Visit /admin/reports to generate compliance reports for NUC and NCCE accreditation. Reports include collection statistics, patron numbers, loan volumes, open access percentages, and thesis submission rates, exportable as PDF or Excel.',
    link: '/admin/reports',
    linkLabel: 'Reports Centre',
  },
  {
    n: 6,
    title: 'Configure AI Content Engine',
    icon: '🤖',
    desc: 'Visit /admin/content-engine to configure the nightly AI harvest. Enable subjects to automatically gather new open access articles, ebooks, and theses from OpenAlex, DOAJ, CORE, Project Gutenberg, OAPEN, and DOAB, adding them to the catalogue automatically.',
    link: '/admin/content-engine',
    linkLabel: 'Content Engine',
  },
];

export default function Tutorial() {
  const [tab, setTab] = useState<TabId>('patrons');

  const steps = tab === 'patrons' ? PATRON_STEPS : STAFF_STEPS;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="pt-20" style={{ background: '#1A4731' }}>
        <div className="max-w-4xl mx-auto px-6 py-14 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">How to Use ESUT Smart Library</h1>
          <p className="text-lg text-white/80">Step-by-step guides for patrons and library staff.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-16 z-30 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 flex gap-1 py-2">
          {(['patrons', 'staff'] as TabId[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === t ? 'text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
              style={tab === t ? { background: '#1A4731' } : {}}
            >
              {t === 'patrons' ? '🎓 For Patrons' : '⚙️ For Library Staff'}
            </button>
          ))}
        </div>
      </div>

      {/* Steps */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {steps.map((step) => (
              <div key={step.n} className="flex gap-5 p-6 bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm"
                  style={{ background: '#f0f9f4' }}
                >
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Step {step.n}</span>
                      <h3 className="text-base font-bold text-neutral-900 mt-0.5">{step.title}</h3>
                    </div>
                    <Link
                      to={step.link}
                      className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                      style={{ background: '#1A4731' }}
                    >
                      {step.linkLabel} →
                    </Link>
                  </div>
                  <p className="text-sm text-neutral-600 mt-2 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 rounded-2xl text-center bg-neutral-50 border border-neutral-200">
            <p className="text-sm text-neutral-600">
              Need more help? Ask{' '}
              <Link to="/ai-librarian" className="font-semibold hover:underline" style={{ color: '#1A4731' }}>
                Lexis the AI Reference Librarian
              </Link>{' '}
              or{' '}
              <Link to="/contact" className="font-semibold hover:underline" style={{ color: '#1A4731' }}>
                contact our librarians
              </Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
