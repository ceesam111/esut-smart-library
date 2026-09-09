import { Link } from 'react-router-dom';
import { contacts } from '@/lib/contacts';

const SERVICES = [
  {
    icon: '📖',
    title: 'Reader Advisory',
    body: 'Personalised recommendations across all disciplines — from coursework reading to leisure scholarship.',
  },
  {
    icon: '🗂️',
    title: 'Subject Guides',
    body: 'Curated pathways through the catalogue, repository, and trusted databases for every faculty.',
  },
  {
    icon: '✍️',
    title: 'Citation Help',
    body: 'Format references in APA 7th edition, Harvard, MLA, or Chicago — verified to current standards.',
  },
  {
    icon: '🎓',
    title: 'Research Consultations',
    body: 'One-on-one sessions for literature reviews, methodology, and academic writing support.',
  },
  {
    icon: '📨',
    title: 'Document Delivery',
    body: 'Request scans of articles, chapters, and grey literature held in the ESUT collection.',
  },
  {
    icon: '🌍',
    title: 'Interlibrary Loans (ILL)',
    body: 'Borrow materials from partner libraries worldwide when ESUT does not hold the title.',
  },
];

export default function ReferenceServices() {
  return (
    <div className="page">
      {/* Hero */}
      <section
        className="text-white"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
      >
        <div className="section py-16 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-3">
            ESUT Smart Library
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold mb-4">
            Reference Services
          </h1>
          <p className="text-base sm:text-lg text-white/80 max-w-2xl leading-relaxed mb-8">
            The Reference Desk at ESUT Smart Library connects scholars, students, and lecturers
            with the right sources, the right citations, and the right people. Ask Lexis — our
            AI Reference Librarian — for an instant answer, or reach a human librarian when your
            question calls for a conversation.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/ai-librarian"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-primary-800 font-semibold hover:bg-white/90 transition-colors shadow-lg"
            >
              💬 Ask Lexis
            </Link>
            <a
              href={contacts.whatsappMessage('Hello, I would like to speak with a human reference librarian at ESUT Smart Library.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/40 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              👋 Contact a Human Librarian
            </a>
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section className="section py-14">
        <div className="max-w-3xl mb-10">
          <h2 className="text-2xl font-serif font-semibold text-neutral-900 mb-2">
            What we help with
          </h2>
          <p className="text-neutral-600">
            Every service below is available to registered patrons — and most are open to walk-ins
            during reference desk hours.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s) => (
            <article
              key={s.title}
              className="p-5 rounded-2xl border border-neutral-200 bg-white hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-3" aria-hidden="true">{s.icon}</div>
              <h3 className="font-semibold text-neutral-900 mb-1.5">{s.title}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Ask Lexis CTA strip */}
      <section className="bg-neutral-50 border-y border-neutral-200">
        <div className="section py-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-xl font-serif font-semibold text-neutral-900 mb-2">
              Need an answer right now?
            </h2>
            <p className="text-neutral-600 text-sm leading-relaxed">
              Lexis is available 24/7 with verified APA 7th-edition citations and source-grounded
              answers across every discipline.
            </p>
          </div>
          <Link
            to="/ai-librarian"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-700 text-white font-semibold hover:bg-primary-800 transition-colors shadow"
            style={{ background: 'var(--color-primary)' }}
          >
            💬 Ask Lexis
          </Link>
        </div>
      </section>

      {/* Contact human librarian */}
      <section className="section py-14">
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-10">
          <h2 className="text-2xl font-serif font-semibold text-neutral-900 mb-3">
            Contact a Human Librarian
          </h2>
          <p className="text-neutral-600 max-w-2xl mb-6 leading-relaxed">
            For complex research, sensitive enquiries, or anything Lexis refers upward, our
            reference team is one tap away.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            <a
              href={contacts.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg">💬</div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">WhatsApp</div>
                <div className="text-sm font-medium text-neutral-900 truncate">{contacts.phoneDisplay}</div>
              </div>
            </a>
            <a
              href={contacts.telHref}
              className="flex items-center gap-3 p-4 rounded-2xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-neutral-800 text-white flex items-center justify-center text-lg">📞</div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600">Call</div>
                <div className="text-sm font-medium text-neutral-900 truncate">{contacts.phoneDisplay}</div>
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
