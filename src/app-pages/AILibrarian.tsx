import { useState, useRef, useEffect, useCallback } from 'react';
import BackButton from '@/components/BackButton';
import LyriaMessageContent from '@/components/ai/LyriaMessageContent';
import { usePageTitle } from '@/hooks/usePageTitle';
import { institutionConfig } from '@config/institution.config';

const LIBRARIAN_NAME = 'Lexis';
const GOLD = '#D4A017';
// Brand colours — green, on-brand with the rest of the app (no blue hero).
const NAVY = '#6B1D2A';
const TEAL = '#0B6E4F';
const API_URL = '/api/ai/reference-librarian';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  showReferral?: boolean;
}

const WELCOME: Message = {
  role: 'assistant',
  ts: Date.now(),
  content: `Hello, I am ${LIBRARIAN_NAME}, your ESUT AI Reference Librarian. I am here to answer any question you have for me.`,
};

const SUGGESTIONS = [
  'Find books on Early Childhood Education',
  'Generate an APA citation for a journal article',
  'What undergraduate long essays do you have?',
  'How do I submit my long essay to the library?',
  'Find open access education research',
  'Explain Harvard referencing format',
  'What resources do you have on Curriculum Studies?',
  'How do I access the course reading lists?',
];

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

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function pickFemaleBrowserVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    'en-ng',
    'zira',
    'female',
    'samantha',
    'victoria',
    'karen',
    'serena',
    'moira',
    'tessa',
    'google uk english female',
    'google us english',
  ];
  return voices.find((voice) => {
    const label = `${voice.lang} ${voice.name}`.toLowerCase();
    return preferred.some((item) => label.includes(item)) && !label.includes('male');
  }) || null;
}

function useLyriaVoice() {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setSpeaking(false);
  }, [cleanup]);

  const speak = useCallback(async (text: string) => {
    const clean = stripMarkdown(text);
    if (!clean) return;
    cleanup();
    setSpeaking(true);
    try {
      const response = await fetch('/api/ai/lyria-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean }),
      });
      if (!response.ok) throw new Error('Voice unavailable');
      if (!response.headers.get('content-type')?.includes('audio/')) throw new Error('Voice fallback requested');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(clean);
        const voice = pickFemaleBrowserVoice();
        if (voice) utterance.voice = voice;
        utterance.lang = voice?.lang || 'en-NG';
        utterance.rate = 0.95;
        utterance.pitch = 1.08;
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } else {
        setSpeaking(false);
      }
    }
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { speak, stop, speaking, supported: true };
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

export default function AILibrarian() {
  usePageTitle('Lexis — ESUT AI Reference Librarian');
  const [messages, setMessages]   = useState<Message[]>([WELCOME]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const abortRef                  = useRef<AbortController | null>(null);
  const { speak, stop, speaking, supported: ttsSupported } = useLyriaVoice();

  const handleMicTranscript = useCallback((text: string) => {
    setInput(text);
    setTimeout(() => send(text), 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { recording, startRecording, stopRecording, supported: micSupported } = useMicInput(handleMicTranscript);

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
      let res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const finalAnswer = accumulated || "I'm temporarily unavailable. Please try again shortly.";
      const showReferral = shouldSuggestReferral(stripMarkdown(finalAnswer));
      const finalContent = showReferral
        ? finalAnswer + '\n\nIf you would like to speak with a human librarian, please use the "Refer to Human Librarian" button below.'
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

  const wa = `https://wa.me/${institutionConfig.whatsappNumber.replace(/\D/g, '')}`;
  const tel = `tel:${institutionConfig.contactPhone}`;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-neutral-50">

      {/* Page header */}
      <div className="shrink-0" style={{ background: NAVY }}>
        <div className="section flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap sm:gap-4 sm:py-4">
          <BackButton />
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white sm:h-11 sm:w-11 sm:text-lg"
            style={{ background: GOLD }}>
            L
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="truncate font-serif text-base font-semibold leading-tight text-white sm:text-lg">
              {LIBRARIAN_NAME} — ESUT AI Reference Librarian
            </h1>
            <p className="truncate text-xs text-white/60">Enugu State University of Science and Technology</p>
          </div>

          {/* Voice / Text reply toggle */}
          {ttsSupported && (
            <div className="flex shrink-0 items-center gap-2">
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
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0">
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
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* LEFT SIDEBAR */}
        <aside className="hidden lg:flex flex-col shrink-0 bg-white border-r border-neutral-200 overflow-y-auto"
          style={{ width: '280px' }}>
          <div className="p-5">
            <h2 className="font-bold text-lg mb-1" style={{ color: NAVY }}>Ask {LIBRARIAN_NAME}</h2>
            <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
              Your AI reference companion for finding resources, generating citations, and navigating ESUT Smart Library services.
            </p>

            {/* Voice mode toggle — sidebar */}
            {ttsSupported && (
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
              </div>
            )}

            {/* Refer to Human Librarian */}
            <div className="mb-5 p-3 rounded-xl border border-amber-200 bg-amber-50">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-2">Need a Human?</p>
              <div className="flex flex-col gap-2">
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#25D366' }}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp Librarian
                </a>
                <a
                  href={tel}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-300 text-neutral-700 bg-white transition-colors hover:bg-neutral-50"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {institutionConfig.contactPhone}
                </a>
              </div>
            </div>

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
                Powered by the configured AI gateway. {LIBRARIAN_NAME} helps with catalogue searches, citation formatting (APA 7th, Harvard, MLA, Chicago), ESUT programme guidance, and library services.
              </p>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL — chat */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Voice mode active banner */}
          {voiceMode && (
            <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2 sm:px-4"
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
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-6" style={{ background: '#f8f9fb' }}>
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
                  className={`max-w-[92%] break-words rounded-2xl px-3 py-2.5 text-sm leading-relaxed sm:max-w-[65%] sm:px-4 sm:py-3
                    ${msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white text-neutral-700 shadow-sm rounded-bl-sm border-l-4'}`}
                  style={msg.role === 'user' ? { background: NAVY } : { borderLeftColor: TEAL }}
                >
                  {msg.content ? (
                    msg.role === 'assistant' ? <LyriaMessageContent content={msg.content} /> : <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <span className="flex gap-1.5 items-center py-0.5">
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.3s]" />
                    </span>
                  )}
                </div>

                {/* Referral buttons appended to assistant messages that trigger it */}
                {msg.role === 'assistant' && msg.showReferral && (
                  <div className="mt-2 flex max-w-[92%] flex-wrap gap-2 sm:max-w-[65%]">
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: '#25D366' }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Refer to Human Librarian
                    </a>
                    <a
                      href={tel}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call Librarian
                    </a>
                  </div>
                )}

                <span className="text-[11px] text-neutral-400 mt-1 px-1">{formatTime(msg.ts)}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Mobile suggestions */}
          <div className="scrollbar-thin flex shrink-0 gap-2 overflow-x-auto border-t border-neutral-100 bg-white px-3 py-2 lg:hidden">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button key={s} onClick={() => send(s)} disabled={streaming}
                className="shrink-0 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs hover:bg-primary-50 hover:text-primary-700 transition-colors whitespace-nowrap disabled:opacity-50">
                {s.length > 32 ? s.slice(0, 30) + '…' : s}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-neutral-200 bg-white p-2 sm:p-4">
            <div className="mx-auto flex max-w-3xl gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
                placeholder={`Ask ${LIBRARIAN_NAME} anything…`}
                className="input min-w-0 flex-1 text-sm"
                disabled={streaming}
              />

              {/* Microphone button */}
              {micSupported && (
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={streaming}
                  title={recording ? 'Stop recording' : 'Speak your question'}
                  aria-label={recording ? 'Stop voice recording' : 'Start voice recording'}
                  className={`px-3 py-2.5 rounded-lg transition-all shrink-0 disabled:opacity-40 relative ${
                    recording ? 'text-white' : 'text-neutral-500 bg-neutral-100 hover:bg-neutral-200'
                  }`}
                  style={recording ? { background: '#dc2626' } : {}}
                >
                  {recording ? (
                    <>
                      <span className="absolute inset-0 rounded-lg bg-red-600 animate-ping opacity-40" />
                      <svg className="w-4 h-4 relative" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              )}

              <button onClick={() => send(input)} disabled={!input.trim() || streaming}
                className="px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                style={{ background: NAVY, color: 'white' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>

            {/* Mobile referral + clear row */}
            <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-3">
              <div className="flex gap-2 lg:hidden">
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
                  Human Librarian
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
              <button onClick={clearChat}
                className="ml-auto text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
