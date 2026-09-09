import { useCallback, useRef, useState } from 'react';
import { SUPABASE_PUBLISHABLE_KEY, supabaseFunctionUrl } from '@/lib/env';

const EDGE_URL = supabaseFunctionUrl('wellbeing-checkin');
const ANON_KEY = SUPABASE_PUBLISHABLE_KEY;

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export default function WellbeingCheckin({ topic }: { topic: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: `Hi, I'm Calm 🌿 — a gentle space to talk through how you're feeling about ${topic.toLowerCase()}. There's no pressure. What's on your mind?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const musicStopRef = useRef<(() => void) | null>(null);

  const playRelaxationMusic = () => {
    musicStopRef.current?.();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    gain.connect(ctx.destination);
    const notes = [261.63, 329.63, 392, 523.25, 392, 329.63];
    let step = 0;
    const interval = window.setInterval(() => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[step % notes.length];
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
      step += 1;
    }, 900);
    setMusicPlaying(true);
    musicStopRef.current = () => {
      window.clearInterval(interval);
      ctx.close();
      setMusicPlaying(false);
    };
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    if (/\b(play|start)\b.*\b(music|relaxation|calm song|sound)\b/i.test(text)) {
      playRelaxationMusic();
      setMessages((m) => [...m, { role: 'assistant', content: 'I have started a soft relaxation melody. Keep your volume low, breathe slowly, and stop it whenever you are ready.' }]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ topic, messages: next }),
      });
      if (res.status === 429) throw new Error('Calm is busy right now — please try again in a moment.');
      if (res.status === 402) throw new Error('The check-in service is temporarily unavailable.');
      const data = await res.json();
      const reply = (data.reply as string) || "I'm here with you. Tell me a little more.";
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 flex flex-col h-[460px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🌿</span>
        <div>
          <h3 className="font-bold text-neutral-900 leading-tight">Talk to Calm</h3>
          <p className="text-xs text-neutral-500">A supportive check-in — not a substitute for professional care.</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-primary-700 text-white rounded-br-sm'
                  : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 rounded-2xl px-4 py-3 rounded-bl-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.3s]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-error-700 mt-2">{error}</p>}
      {musicPlaying && <button onClick={() => musicStopRef.current?.()} className="btn-outline mt-3 w-full">Stop relaxation music</button>}

      <div className="flex gap-2 mt-3">
        <input
          className="input"
          placeholder="Type how you're feeling…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()} className="btn-primary shrink-0">
          Send
        </button>
        <MicButton onTranscript={setInput} disabled={loading} />
      </div>
    </div>
  );
}

function MicButton({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false);
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const start = useCallback(() => {
    if (!supported || disabled) return;
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-NG';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => onTranscript(event.results[0][0].transcript);
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognition.start();
    setRecording(true);
  }, [disabled, onTranscript, supported]);
  if (!supported) return null;
  return <button type="button" onClick={start} disabled={disabled || recording} className="btn-outline shrink-0">{recording ? 'Listening...' : '🎙️'}</button>;
}
