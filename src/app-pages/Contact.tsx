import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const SUBJECTS = [
  'General Inquiry',
  'Resource Request',
  'Technical Support',
  'Feedback',
  'Partnership',
];

const HOURS = [
  { day: 'Monday – Friday', time: '8:00am – 8:00pm WAT' },
  { day: 'Saturday',        time: '9:00am – 5:00pm WAT' },
  { day: 'Sunday',          time: 'Closed' },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: 'library@esut.edu.ng',
          to_name: 'ESUT Library Team',
          subject: `[${form.subject}] Contact from ${form.name}`,
          html: `<p><strong>From:</strong> ${form.name} (${form.email})</p><p><strong>Subject:</strong> ${form.subject}</p><p>${form.message.replace(/\n/g, '<br>')}</p>`,
        },
      });
      setSent(true);
    } catch {
      setError('Something went wrong. Please email us directly at library@esut.edu.ng');
    } finally {
      setSending(false);
    }
  }

  const inputCls = 'w-full border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="pt-20" style={{ background: '#6B1D2A' }}>
        <div className="max-w-4xl mx-auto px-6 py-14 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Contact ESUT Library</h1>
          <p className="text-lg text-white/80">We are here to help. Reach us by form, phone, or WhatsApp.</p>
        </div>
      </div>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-start">

          {/* Contact Form */}
          <div>
            <h2 className="text-xl font-bold text-neutral-900 mb-6">Send a Message</h2>
            {sent ? (
              <div className="text-center py-12 bg-green-50 rounded-xl border border-green-200">
                <div className="text-4xl mb-3">✓</div>
                <p className="font-semibold text-neutral-900">Message sent!</p>
                <p className="text-sm text-neutral-500 mt-1">We'll get back to you within 2 working days.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Full Name</label>
                  <input required value={form.name} onChange={set('name')} placeholder="Your full name" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Email Address</label>
                  <input type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Subject</label>
                  <select value={form.subject} onChange={set('subject')} className={inputCls}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Message</label>
                  <textarea required rows={6} value={form.message} onChange={set('message')}
                    placeholder="How can we help you?" className={`${inputCls} resize-none`} />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3 rounded-lg font-semibold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#6B1D2A' }}
                >
                  {sending ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Contact Details */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-neutral-900 mb-5">Contact Details</h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="text-xl shrink-0">📍</span>
                  <div>
                    <p className="font-semibold text-neutral-800 text-sm">Address</p>
                    <p className="text-neutral-600 text-sm">Enugu State University of Science and Technology<br />Enugu, Enugu State, Nigeria</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl shrink-0">📞</span>
                  <div>
                    <p className="font-semibold text-neutral-800 text-sm">Telephone</p>
                    <a href="tel:+2348039473344" className="text-sm hover:underline" style={{ color: '#6B1D2A' }}>
                      +234 803 947 3344
                    </a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl shrink-0">💬</span>
                  <div>
                    <p className="font-semibold text-neutral-800 text-sm">WhatsApp</p>
                    <a href="https://wa.me/2348039473344" target="_blank" rel="noopener noreferrer"
                      className="text-sm hover:underline" style={{ color: '#6B1D2A' }}>
                      Chat on WhatsApp
                    </a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl shrink-0">✉️</span>
                  <div>
                    <p className="font-semibold text-neutral-800 text-sm">Email</p>
                    <a href="mailto:library@esut.edu.ng" className="text-sm hover:underline" style={{ color: '#6B1D2A' }}>
                      library@esut.edu.ng
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-neutral-900 mb-3 text-sm">Opening Hours</h3>
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                {HOURS.map((h, i) => (
                  <div key={h.day} className={`flex justify-between px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}`}>
                    <span className="text-neutral-700 font-medium">{h.day}</span>
                    <span className={h.time === 'Closed' ? 'text-red-500 font-medium' : 'text-neutral-600'}>{h.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Map placeholder */}
            <div className="rounded-xl overflow-hidden border border-neutral-200" style={{ height: 180, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <span className="text-3xl">📍</span>
              <p className="text-sm font-semibold text-neutral-700">ESUT Campus, Enugu, Enugu State</p>
              <a
                href="https://maps.google.com/?q=Enugu+State+University+of+Science+and+Technology+Enugu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium px-4 py-1.5 rounded-full text-white hover:opacity-90 transition-opacity"
                style={{ background: '#6B1D2A' }}
              >
                Get Directions →
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
