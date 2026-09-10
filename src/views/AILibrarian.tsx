'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { LYRIA_GREETING, stripMarkdown, isLowConfidence } from '@/lib/lyria';
import { contacts } from '@/lib/contacts';

const LIBRARIAN_NAME = 'Lexis';
const GOLD = '#D4A017';
const NAVY = '#1F4E79';
const TEAL = '#005F73';
const EDGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-librarian`;
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '') as string;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const WELCOME: Message = {
  role: 'assistant',
  ts: Date.now(),
  content: LYRIA_GREETING,
};

const SUGGESTIONS = [
  'Find books on Early Childhood Education',
  'Generate an APA citation for a journal article',
  'What NCE project reports do you have?',
  'How do I submit my long essay to the library?',
  'Find open access education research',
  'Explain Harvard referencing format',
  'What resources do you have on Curriculum Studies?',
  'How do I access the course reading lists?',
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

export default function AILibrarian() {
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const abortRef                  = useRef<AbortController | null>(null);
  const { speak, stop, speaking, supported } = useSpeech();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || streaming) return;
    setInput('');
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
      }

      const finalText = accumulated || "I'm temporarily unavailable. Please try again shortly.";
      if (!accumulated) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: finalText };
          return updated;
        });
      }
      if (voiceMode) speak(finalText);
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
    <div className="pt-16 flex flex-col" style={{ height: '100dvh', minHeight: '600px' }}>

      {/* Page header */}
      <div className="shrink-0" style={{ background: NAVY }}>
        <div className="section py-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ background: GOLD }}>
            L
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-serif font-semibold text-lg leading-tight">
              {LIBRARIAN_NAME} — ESUT Reference (AI) Librarian
            </h1>
            <p className="text-white/60 text-xs">Enugu State University of Science and Technology</p>
          </div>

          {/* Voice / Text reply toggle */}
          {supported && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-white/60 text-xs hidden sm:block">Reply by</span>
              <div className="flex rounded-lg overflow-hidden border border-white/20">
                <button
                  onClick={() => { setVoiceMode(false); stop(); }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    !voiceMode ? 'bg-white text-primary-800' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 6h16M4 10h16M4 14h10" />
                  </svg>
                  Text
                </button>
                <button
                  onClick={() => setVoiceMode(true)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    voiceMode ? 'bg-white text-primary-800' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072M12 9v6m0 0l-3-3m3 3l3-3M19.07 4.93a10 10 0 010 14.14" />
                  </svg>
                  Voice
                </button>
              </div>
            </div>
          )}

          {/* Speaking indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {speaking ? (
              <>
                <span className="flex items-end gap-px h-4">
                  {[4, 8, 14, 10, 6].map((h, i) => (
                    <span key={i} className="w-0.5 rounded-full bg-emerald-400 animate-bounce"
                      style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }} />
                  ))}
                </span>
                <button onClick={stop} className="text-white/70 hover:text-white text-xs transition-colors">
                  Stop
                </button>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/70 text-xs">Online</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT SIDEBAR */}
        <aside className="hidden lg:flex flex-col shrink-0 bg-white border-r border-neutral-200 overflow-y-auto"
          style={{ width: '280px' }}>
          <div className="p-5">
            <h2 className="font-bold text-lg mb-1" style={{ color: NAVY }}>Ask {LIBRARIAN_NAME}</h2>
            <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
              Your AI research companion for finding resources, generating citations, and navigating ESUT Smart Library services.
            </p>

            {/* Voice mode toggle — sidebar */}
            {supported && (
              <div className="mb-5 p-3 rounded-xl border border-neutral-200 bg-neutral-50">
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Reply Mode</p>
                <div className="flex rounded-lg overflow-hidden border border-neutral-200 bg-white">
                  <button
                    onClick={() => { setVoiceMode(false); stop(); }}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      !voiceMode ? 'text-white' : 'text-neutral-500 hover:bg-neutral-50'
                    }`}
                    style={!voiceMode ? { background: NAVY } : {}}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
                    </svg>
                    Text
                  </button>
                  <button
                    onClick={() => setVoiceMode(true)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      voiceMode ? 'text-white' : 'text-neutral-500 hover:bg-neutral-50'
                    }`}
                    style={voiceMode ? { background: TEAL } : {}}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072M19.07 4.93a10 10 0 010 14.14M12 9v6" />
                    </svg>
                    Voice
                  </button>
                </div>
                {voiceMode && (
                  <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
                    Responses will be read aloud automatically after each reply.
                  </p>
                )}
              </div>
            )}

            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Suggested Questions
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={streaming}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs leading-relaxed transition-all border disabled:opacity-50"
                  style={{ color: TEAL, borderColor: TEAL, background: 'white' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f0fafb'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">About</p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Powered by the configured AI gateway. {LIBRARIAN_NAME} helps with catalogue searches, citation formatting (APA, Harvard, MLA, Chicago), NCE programme guidance, and library services.
              </p>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL — chat */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* Voice mode active banner */}
          {voiceMode && (
            <div className="shrink-0 flex items-center justify-between px-4 py-2"
              style={{ background: TEAL }}>
              <div className="flex items-center gap-2">
                {speaking ? (
                  <span className="flex items-end gap-px h-4">
                    {[4, 8, 14, 10, 6].map((h, i) => (
                      <span key={i} className="w-0.5 rounded-full bg-white animate-bounce"
                        style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }} />
                    ))}
                  </span>
                ) : (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072M19.07 4.93a10 10 0 010 14.14M12 9v6" />
                  </svg>
                )}
                <span className="text-white text-xs font-medium">
                  {speaking ? `${LIBRARIAN_NAME} is speaking…` : 'Voice replies enabled — responses will be read aloud'}
                </span>
              </div>
              {speaking && (
                <button onClick={stop} className="text-white/80 hover:text-white text-xs font-medium underline">
                  Stop
                </button>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0" style={{ background: '#f8f9fb' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: GOLD }}>
                      L
                    </div>
                    <span className="text-xs font-semibold" style={{ color: NAVY }}>{LIBRARIAN_NAME}</span>
                  </div>
                )}
                <div
                  className={`max-w-[75%] sm:max-w-[65%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white text-neutral-700 shadow-sm rounded-bl-sm border-l-4'}`}
                  style={msg.role === 'user' ? { background: NAVY } : { borderLeftColor: TEAL }}
                >
                  {msg.content ? (
                    msg.role === 'assistant' ? stripMarkdown(msg.content) : msg.content
                  ) : (
                    <span className="flex gap-1.5 items-center py-0.5">
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.3s]" />
                    </span>
                  )}
                  {msg.role === 'assistant' && msg.content && (isLowConfidence(msg.content) || i === messages.length - 1) && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 flex flex-wrap gap-2">
                      <a href={contacts.whatsappMessage('Hello, I would like to speak with a human reference librarian at ESUT Smart Library.')}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700">
                        💬 Refer to Human Librarian (WhatsApp)
                      </a>
                      <a href={contacts.telHref}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-medium hover:bg-neutral-50">
                        📞 Call {contacts.phoneDisplay}
                      </a>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-neutral-400 mt-1 px-1">{formatTime(msg.ts)}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Mobile suggestions */}
          <div className="lg:hidden px-4 py-2 bg-white border-t border-neutral-100 flex gap-2 overflow-x-auto scrollbar-thin shrink-0">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button key={s} onClick={() => send(s)} disabled={streaming}
                className="shrink-0 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs hover:bg-primary-50 hover:text-primary-700 transition-colors whitespace-nowrap disabled:opacity-50">
                {s.length > 32 ? s.slice(0, 30) + '…' : s}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="shrink-0 bg-white border-t border-neutral-200 p-3 sm:p-4">
            <div className="max-w-3xl mx-auto flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
                placeholder={`Ask ${LIBRARIAN_NAME} anything…`}
                className="input flex-1"
                disabled={streaming}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || streaming}
                className="px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                style={{ background: NAVY, color: 'white' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <div className="max-w-3xl mx-auto mt-1.5 text-center">
              <button onClick={clearChat}
                className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
