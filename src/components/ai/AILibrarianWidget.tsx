import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import LyriaMessageContent from '@/components/ai/LyriaMessageContent';
import { institutionConfig } from '@config/institution.config';
import { SUPABASE_PUBLISHABLE_KEY, supabaseFunctionUrl } from '@/lib/env';

const LIBRARIAN_NAME = 'Lexis';
const GOLD = '#C9A84C';
const NAVY = '#1F4E79';
const TEAL = '#005F73';
const EDGE_URL = supabaseFunctionUrl('ai-librarian');
const ANON_KEY = SUPABASE_PUBLISHABLE_KEY;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  showReferral?: boolean;
}

const REFERRAL_TRIGGERS = [
  "i don't know", "i'm not sure", "i cannot", "i can't", "unable to", "beyond my",
  "please contact", "speak to a librarian", "consult a librarian", "not available",
  "outside my", "i don't have access",
];

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s?/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ''))
    .replace(/^>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function shouldSuggestReferral(text: string): boolean {
  const lower = text.toLowerCase();
  return REFERRAL_TRIGGERS.some((t) => lower.includes(t));
}

const WELCOME: Message = {
  role: 'assistant',
  content: `Hello, I am ${LIBRARIAN_NAME}, your ESUT AI Reference Librarian. I am here to answer any question you have for me.`,
  ts: Date.now(),
};

const WIDGET_SUGGESTIONS = [
  'Find books on Early Childhood Education',
  'Generate an APA citation',
  'How do I submit my long essay?',
  'What are postgraduate loan rules?',
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback((text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
    utterance.lang = 'en-GB';
    utterance.rate = 0.92;
    utterance.pitch = 1.1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { speak, stop, speaking, supported };
}

function useMicInput(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startRecording = useCallback(() => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-NG';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onTranscript(transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [supported, onTranscript]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  return { recording, startRecording, stopRecording, supported };
}

export default function AILibrarianWidget() {
  const [open, setOpen]           = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [fabBottom, setFabBottom] = useState(24);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const abortRef                  = useRef<AbortController | null>(null);
  const { speak, stop, speaking, supported: ttsSupported } = useSpeech();

  const wa = `https://wa.me/${institutionConfig.whatsappNumber.replace(/\D/g, '')}`;
  const tel = `tel:${institutionConfig.contactPhone}`;

  const handleMicTranscript = useCallback((text: string) => {
    send(text);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { recording, startRecording, stopRecording, supported: micSupported } = useMicInput(handleMicTranscript);

  useEffect(() => {
    if (open && !minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open, minimized]);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const update = () => {
      const rect = footer.getBoundingClientRect();
      const vh = window.innerHeight;
      setFabBottom(rect.top < vh ? vh - rect.top + 32 : 24);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || streaming) return;
    setInput('');
    setMinimized(false);
    stop();

    const userMsg: Message = { role: 'user', content: msg, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);

    const last10 = next.slice(-10);
    const firstUser = last10.findIndex((m) => m.role === 'user');
    const apiMessages = last10.slice(firstUser >= 0 ? firstUser : 0).map(({ role, content }) => ({ role, content }));

    const placeholder: Message = { role: 'assistant', content: '', ts: Date.now() };
    setMessages((prev) => [...prev, placeholder]);
    abortRef.current = new AbortController();

    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
          return updated;
        });
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }

      const finalAnswer = accumulated || "I'm temporarily unavailable. Please try again shortly.";
      const showReferral = shouldSuggestReferral(stripMarkdown(finalAnswer));
      const finalContent = showReferral
        ? finalAnswer + '\n\nIf you would like to speak with a human librarian, please use the button below.'
        : finalAnswer;

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: finalContent, showReferral };
        return updated;
      });

      if (voiceMode) speak(finalContent);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errMsg = "I'm temporarily unavailable. Please try again shortly.";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: errMsg };
          return updated;
        });
        if (voiceMode) speak(errMsg);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, voiceMode, speak, stop]);

  const clearChat = () => {
    abortRef.current?.abort();
    stop();
    setMessages([{ ...WELCOME, ts: Date.now() }]);
    setStreaming(false);
    setInput('');
  };

  const toggleVoice = () => {
    if (voiceMode) stop();
    setVoiceMode((v) => !v);
  };

  return (
    <>
      {open && (
        <div
          className="fixed right-4 sm:right-6 z-40 flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-neutral-200"
          style={{ bottom: fabBottom + 64, width: 'min(380px, calc(100vw - 2rem))', maxHeight: '70vh', background: 'white', transition: 'bottom 150ms ease' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: NAVY }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: GOLD }}
            >
              L
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">{LIBRARIAN_NAME} — ESUT AI Reference Librarian</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {speaking ? (
                  <span className="flex items-end gap-px h-3">
                    {[0, 150, 300, 150, 0].map((delay, i) => (
                      <span key={i} className="w-0.5 rounded-full bg-emerald-400 animate-bounce"
                        style={{ height: `${[4, 8, 12, 8, 4][i]}px`, animationDelay: `${delay}ms` }} />
                    ))}
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
                <span className="text-white/60 text-xs">{speaking ? 'Speaking…' : 'Online'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {ttsSupported && (
                <button
                  onClick={toggleVoice}
                  title={voiceMode ? 'Switch to text replies' : 'Switch to voice replies'}
                  className={`p-1.5 rounded transition-colors text-xs font-medium ${
                    voiceMode ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                  aria-label={voiceMode ? 'Voice mode on' : 'Voice mode off'}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072M19.07 4.93a10 10 0 010 14.14M12 9v6" />
                  </svg>
                </button>
              )}
              <Link to="/ai-librarian" title="Open full page"
                className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs font-mono">
                ⤢
              </Link>
              <button onClick={() => setMinimized((m) => !m)} title="Minimise"
                className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button onClick={() => { setOpen(false); stop(); }} title="Close"
                className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Voice mode banner */}
              {voiceMode && (
                <div className="flex items-center justify-between px-4 py-1.5 shrink-0"
                  style={{ background: TEAL }}>
                  <span className="text-white text-xs font-medium">Voice replies on</span>
                  {speaking && (
                    <button onClick={stop} className="text-white/80 hover:text-white text-xs underline">
                      Stop
                    </button>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50 min-h-0" style={{ maxHeight: '42vh' }}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                    <div
                      className={`max-w-[88%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'text-white rounded-br-sm'
                          : 'bg-white text-neutral-700 shadow-sm rounded-bl-sm border-l-4'}`}
                      style={msg.role === 'user' ? { background: NAVY } : { borderLeftColor: TEAL }}
                    >
                      {msg.content ? (
                        msg.role === 'assistant' ? <LyriaMessageContent content={msg.content} compact /> : <span className="whitespace-pre-wrap">{msg.content}</span>
                      ) : (
                        <span className="flex gap-1 items-center py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.3s]" />
                        </span>
                      )}
                    </div>

                    {/* Inline referral buttons */}
                    {msg.role === 'assistant' && msg.showReferral && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[88%]">
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white"
                          style={{ background: '#25D366' }}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Refer to Human Librarian
                        </a>
                        <a
                          href={tel}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-neutral-300 text-neutral-600 bg-white"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          Call
                        </a>
                      </div>
                    )}

                    <span className="text-[10px] text-neutral-400 mt-1 px-1">{formatTime(msg.ts)}</span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Quick suggestions */}
              {messages.length <= 2 && (
                <div className="px-3 py-2 bg-white border-t border-neutral-100 flex gap-2 overflow-x-auto scrollbar-thin shrink-0">
                  {WIDGET_SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs hover:bg-primary-50 hover:text-primary-700 transition-colors whitespace-nowrap">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-3 pb-2 pt-2 bg-white border-t border-neutral-100 shrink-0">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
                    placeholder={`Ask ${LIBRARIAN_NAME} anything…`}
                    className="input flex-1 py-2 text-sm"
                    disabled={streaming}
                  />

                  {/* Mic button */}
                  {micSupported && (
                    <button
                      onClick={recording ? stopRecording : startRecording}
                      disabled={streaming}
                      aria-label={recording ? 'Stop recording' : 'Speak your question'}
                      title={recording ? 'Stop recording' : 'Speak your question'}
                      className={`p-2 rounded-lg transition-all shrink-0 relative disabled:opacity-40 ${
                        recording ? 'text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}
                      style={recording ? { background: '#dc2626' } : {}}
                    >
                      {recording && <span className="absolute inset-0 rounded-lg bg-red-600 animate-ping opacity-40" />}
                      {recording ? (
                        <svg className="w-4 h-4 relative" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      )}
                    </button>
                  )}

                  <button onClick={() => send(input)} disabled={!input.trim() || streaming}
                    className="p-2 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                    style={{ background: NAVY, color: 'white' }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>

                {/* Refer to Human Librarian persistent button */}
                <div className="flex items-center justify-between mt-1.5 gap-2">
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-semibold text-green-700 hover:text-green-900 transition-colors"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Refer to Human Librarian
                  </a>
                  <button onClick={clearChat}
                    className="text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors">
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={open ? () => { setOpen(false); stop(); } : () => { setOpen(true); setMinimized(false); }}
        className="fixed right-4 sm:right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ bottom: fabBottom, background: NAVY, transition: 'bottom 150ms ease' }}
        aria-label={open ? 'Close AI Reference Librarian' : 'Open Lexis — ESUT AI Reference Librarian'}
      >
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )}
      </button>
    </>
  );
}
