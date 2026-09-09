import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Block {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  blocks: Block[];
  status: string;
}

function renderBlock(block: Block) {
  const d = block.data || {};
  switch (block.type) {
    case 'hero':
      return (
        <section
          key={block.id}
          className="relative flex items-center justify-center text-white py-24 px-6 text-center"
          style={{
            background: d.bg_image
              ? `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)), url(${d.bg_image}) center/cover no-repeat`
              : '#1A4731',
            minHeight: d.height || '400px',
          }}
        >
          <div className="max-w-3xl mx-auto">
            {d.heading && <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">{d.heading}</h1>}
            {d.subheading && <p className="text-lg md:text-xl text-white/80 mb-8">{d.subheading}</p>}
            {d.cta_label && d.cta_url && (
              <Link
                to={d.cta_url}
                className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3 rounded-full transition-colors"
              >
                {d.cta_label}
              </Link>
            )}
          </div>
        </section>
      );

    case 'richtext':
      return (
        <section key={block.id} className="py-10 px-6">
          <div
            className="prose prose-lg max-w-4xl mx-auto text-neutral-800"
            dangerouslySetInnerHTML={{ __html: d.html || '' }}
          />
        </section>
      );

    case 'image':
      return (
        <section key={block.id} className="py-8 px-6">
          <div className="max-w-4xl mx-auto">
            {d.url && (
              <img
                src={d.url}
                alt={d.alt || ''}
                className="w-full rounded-xl shadow-md"
              />
            )}
            {d.caption && <p className="text-sm text-neutral-500 text-center mt-2">{d.caption}</p>}
          </div>
        </section>
      );

    case 'two_col':
      return (
        <section key={block.id} className="py-10 px-6">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-start">
            <div
              className="prose prose-neutral"
              dangerouslySetInnerHTML={{ __html: d.left || '' }}
            />
            <div
              className="prose prose-neutral"
              dangerouslySetInnerHTML={{ __html: d.right || '' }}
            />
          </div>
        </section>
      );

    case 'card_grid': {
      const cards: any[] = d.cards || [];
      return (
        <section key={block.id} className="py-10 px-6 bg-neutral-50">
          <div className="max-w-5xl mx-auto">
            {d.heading && <h2 className="text-2xl font-bold text-neutral-900 mb-2 text-center">{d.heading}</h2>}
            {d.subheading && <p className="text-neutral-500 text-center mb-8">{d.subheading}</p>}
            <div className={`grid gap-6 ${cards.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              {cards.map((card: any, i: number) => (
                <div key={i} className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                  {card.icon && <div className="text-3xl mb-3">{card.icon}</div>}
                  {card.title && <h3 className="font-semibold text-neutral-900 mb-2">{card.title}</h3>}
                  {card.text && <p className="text-sm text-neutral-600">{card.text}</p>}
                  {card.link && card.link_label && (
                    <Link to={card.link} className="text-primary-700 text-sm font-medium mt-3 inline-block hover:underline">
                      {card.link_label} →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'team_grid': {
      const members: any[] = d.members || [];
      return (
        <section key={block.id} className="py-10 px-6">
          <div className="max-w-5xl mx-auto">
            {d.heading && <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">{d.heading}</h2>}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {members.map((m: any, i: number) => (
                <div key={i} className="text-center">
                  {m.photo && (
                    <img src={m.photo} alt={m.name} className="w-24 h-24 rounded-full object-cover mx-auto mb-3 shadow" />
                  )}
                  {!m.photo && (
                    <div className="w-24 h-24 rounded-full bg-neutral-200 flex items-center justify-center mx-auto mb-3 text-2xl text-neutral-400">
                      {(m.name || 'U')[0]}
                    </div>
                  )}
                  <p className="font-semibold text-neutral-900">{m.name}</p>
                  <p className="text-sm text-neutral-500">{m.role}</p>
                  {m.email && <a href={`mailto:${m.email}`} className="text-xs text-primary-700 hover:underline">{m.email}</a>}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'faq': {
      const faqs: any[] = d.items || [];
      return (
        <section key={block.id} className="py-10 px-6">
          <div className="max-w-3xl mx-auto">
            {d.heading && <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">{d.heading}</h2>}
            <div className="divide-y divide-neutral-200">
              {faqs.map((faq: any, i: number) => (
                <FAQItem key={i} question={faq.q} answer={faq.a} />
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'contact_form':
      return (
        <section key={block.id} className="py-10 px-6">
          <div className="max-w-xl mx-auto">
            {d.heading && <h2 className="text-2xl font-bold text-neutral-900 mb-6 text-center">{d.heading}</h2>}
            <ContactForm email={d.email || ''} />
          </div>
        </section>
      );

    case 'embed':
      return (
        <section key={block.id} className="py-8 px-6">
          <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-md" style={{ height: d.height || '450px' }}>
            {d.url && (
              <iframe src={d.url} className="w-full h-full border-0" title={d.title || 'Embedded content'} />
            )}
          </div>
        </section>
      );

    case 'cta_banner':
      return (
        <section key={block.id} className="py-14 px-6 bg-primary-700 text-white text-center">
          <div className="max-w-2xl mx-auto">
            {d.heading && <h2 className="text-3xl font-bold mb-3">{d.heading}</h2>}
            {d.text && <p className="text-white/80 mb-7 text-lg">{d.text}</p>}
            {d.cta_label && d.cta_url && (
              <Link
                to={d.cta_url}
                className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3 rounded-full transition-colors"
              >
                {d.cta_label}
              </Link>
            )}
          </div>
        </section>
      );

    case 'stats_bar': {
      const stats: any[] = d.stats || [];
      return (
        <section key={block.id} className="py-10 px-6 bg-neutral-900 text-white">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s: any, i: number) => (
              <div key={i}>
                <p className="text-3xl font-bold text-amber-400">{s.value}</p>
                <p className="text-sm text-neutral-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      );
    }

    case 'video':
      return (
        <section key={block.id} className="py-8 px-6">
          <div className="max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden shadow-md">
            {d.url && (
              <iframe
                src={d.url.replace('watch?v=', 'embed/')}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={d.title || 'Video'}
              />
            )}
          </div>
        </section>
      );

    case 'spacer':
      return <div key={block.id} style={{ height: d.height || '40px' }} />;

    case 'divider':
      return (
        <div key={block.id} className="py-4 px-6">
          <hr className="border-neutral-200 max-w-5xl mx-auto" />
        </div>
      );

    default:
      return null;
  }
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left gap-3 group"
      >
        <span className="font-medium text-neutral-900 group-hover:text-primary-700 transition-colors">{question}</span>
        <span className="text-neutral-400 text-lg">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="mt-3 text-neutral-600 text-sm leading-relaxed">{answer}</p>}
    </div>
  );
}

function ContactForm({ email }: { email: string }) {
  const [values, setValues] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke('send-email', {
      body: {
        to: email || 'library@esut.edu.ng',
        to_name: 'Library Team',
        subject: `Website Contact from ${values.name}`,
        html: `<p><strong>From:</strong> ${values.name} (${values.email})</p><p>${values.message}</p>`,
      },
    });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">✓</div>
        <p className="font-medium text-neutral-900">Message sent!</p>
        <p className="text-sm text-neutral-500 mt-1">We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        required
        placeholder="Your name"
        value={values.name}
        onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
        className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <input
        type="email"
        required
        placeholder="Your email"
        value={values.email}
        onChange={e => setValues(v => ({ ...v, email: e.target.value }))}
        className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <textarea
        required
        rows={5}
        placeholder="Your message"
        value={values.message}
        onChange={e => setValues(v => ({ ...v, message: e.target.value }))}
        className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
      />
      <button
        type="submit"
        className="w-full bg-primary-700 hover:bg-primary-800 text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        Send Message
      </button>
    </form>
  );
}

export default function CmsPage() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const location = useLocation();
  const slug = paramSlug || location.pathname.replace(/^\//, '').split('/')[0];
  const [page, setPage] = useState<CMSPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from('cms_pages')
        .select('id, title, slug, blocks, status')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (!data) {
        setNotFound(true);
      } else {
        setPage(data as CMSPage);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <p className="text-5xl font-bold text-neutral-200 mb-4">404</p>
        <h1 className="text-xl font-semibold text-neutral-800 mb-2">Page not found</h1>
        <p className="text-neutral-500 mb-6">This page doesn't exist or has been unpublished.</p>
        <Link to="/" className="text-primary-700 hover:underline text-sm font-medium">← Back to Home</Link>
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="min-h-screen bg-white">
      {(page.blocks || []).map(block => renderBlock(block))}
    </div>
  );
}
