import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { institutionConfig } from '@config/institution.config';
import BackButton from '@/components/BackButton';

const NAVY = '#1F4E79';
const TEAL = '#005F73';
const GOLD = '#C9A84C';

const wa = `https://wa.me/${institutionConfig.whatsappNumber.replace(/\D/g, '')}`;
const tel = `tel:${institutionConfig.contactPhone}`;

const SERVICES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Reader Advisory',
    desc: 'Personalised book and resource recommendations tailored to your course, research area, or reading interests from our professional librarians.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    title: 'Subject Guides',
    desc: 'Curated research guides organised by faculty and subject area, pointing you to the best databases, journals, and resources for your discipline.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'Citation Help',
    desc: 'Assistance with APA 7th edition, Harvard, MLA, Chicago, and OSCOLA citation styles. Ask Lexis for instant AI-generated citations, or visit the library for hands-on guidance.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Research Consultations',
    desc: 'Book a one-on-one consultation with a subject librarian to plan your research strategy, identify relevant sources, and navigate complex databases.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
    title: 'Document Delivery',
    desc: 'Request scanned chapters, articles, or specific pages from our physical collection delivered digitally to your registered email address.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    title: 'Interlibrary Loans',
    desc: 'Need a resource we don\'t hold? We can borrow it from another library on your behalf through our interlibrary loan (ILL) service.',
    link: '/dashboard/ill',
    linkLabel: 'Request an ILL',
  },
];

export default function CourseReserves() {
  usePageTitle('Reference Services — ESUT Smart Library');

  return (
    <div className="page">

      {/* Hero */}
      <section className="pt-8 pb-12" style={{ background: '#1A4731' }}>
        <div className="section">
          <BackButton />
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-5 text-xs font-semibold"
              style={{ borderColor: `${GOLD}60`, color: GOLD, background: `${GOLD}12` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
              ESUT Smart Library
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-white mb-4 leading-tight">
              Reference Services
            </h1>
            <p className="text-white/75 leading-relaxed text-base sm:text-lg max-w-xl">
              Our Reference Services team is dedicated to supporting your learning, teaching, and research at every stage — from finding the right resource to completing your citations.
            </p>
          </div>
        </div>
      </section>

      {/* Ask Lyria CTA */}
      <section className="py-10 bg-white border-b border-neutral-100">
        <div className="section">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl border"
            style={{ borderColor: `${TEAL}30`, background: `${TEAL}06` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shrink-0"
              style={{ background: TEAL }}>
              L
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-lg font-semibold text-neutral-800 mb-1">
                Get Instant Help from Lexis
              </h2>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Lexis, your ESUT AI Reference Librarian, can answer research questions, generate APA citations, recommend resources, and guide you through library services 24/7.
              </p>
            </div>
            <Link
              to="/ai-librarian"
              className="shrink-0 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: TEAL }}
            >
              Ask Lexis Now →
            </Link>
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-14 bg-neutral-50">
        <div className="section">
          <h2 className="text-2xl font-serif font-semibold mb-2" style={{ color: NAVY }}>
            Our Reference Services
          </h2>
          <p className="text-neutral-500 text-sm mb-8">
            Professional library support for students, faculty, and researchers at ESUT.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((svc) => (
              <div key={svc.title} className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: NAVY }}>
                  {svc.icon}
                </div>
                <h3 className="font-semibold text-neutral-800 text-base">{svc.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed flex-1">{svc.desc}</p>
                {svc.link && (
                  <Link
                    to={svc.link}
                    className="inline-flex items-center gap-1 text-xs font-semibold transition-colors mt-1"
                    style={{ color: TEAL }}
                  >
                    {svc.linkLabel}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact a Human Librarian */}
      <section className="py-14 bg-white">
        <div className="section">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: `${GOLD}18` }}>
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke={GOLD}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-serif font-semibold mb-2" style={{ color: NAVY }}>
              Contact a Human Librarian
            </h2>
            <p className="text-neutral-500 text-sm leading-relaxed mb-8">
              Our professional librarians are available during library hours to assist you in person, by phone, or via WhatsApp. For complex research needs, subject consultations, or anything Lexis couldn't resolve — we're here.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: '#25D366' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp a Librarian
              </a>

              <a
                href={tel}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm border-2 transition-colors hover:bg-neutral-50"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {institutionConfig.contactPhone}
              </a>
            </div>

            <p className="mt-6 text-xs text-neutral-400">
              You can also{' '}
              <Link to="/contact" className="underline hover:text-neutral-600 transition-colors">
                send us a message
              </Link>{' '}
              or visit the library in person at {institutionConfig.address}.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
