import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { useAuth } from '@/hooks/useAuth';
import { institutionConfig } from '@config/institution.config';
import BackButton from '@/components/BackButton';
import HandbookSection from '@/components/dashboard/HandbookSection';

export default function LibraryCard() {
  const { loading, profile } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto card p-8 text-center mt-10">
        <div className="text-5xl mb-4">📇</div>
        <h2 className="text-xl font-semibold text-neutral-800 mb-2">Library Card Not Found</h2>
        <p className="text-neutral-500 text-sm mb-6">Please complete registration first.</p>
        <Link to="/register" className="btn-primary">Register Now</Link>
      </div>
    );
  }

  const issued = profile.status === 'active' && !!profile.library_number;
  const cardCode = profile.library_number || profile.patron_id;
  const cardName = formatCardName(profile);
  const validUntil = profile.membership_expires_at
    ? new Date(profile.membership_expires_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '—';

  async function renderCanvas(): Promise<HTMLCanvasElement | null> {
    if (!profile) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = 680; canvas.height = 400;
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, institutionConfig.primaryColour);
    g.addColorStop(1, institutionConfig.secondaryColour);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, canvas.height, 24); ctx.fill();

    ctx.fillStyle = '#C9A84C'; ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(institutionConfig.name, 40, 50);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(cardName, 40, 108);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '16px Inter, sans-serif';
    ctx.fillText([profile.department, profile.faculty_name].filter(Boolean).join(' • ') || profile.institution || '', 40, 142);

    const qrSize = 140, qrX = canvas.width - qrSize - 40, qrY = 60;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12); ctx.fill();
    const qrCanvas = document.createElement('canvas');
    await new Promise<void>((res) => QRCode.toCanvas(qrCanvas, cardCode, { width: qrSize, margin: 0, color: { dark: institutionConfig.primaryColour, light: '#fff' } }, () => res()));
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    if (profile.profile_photo_url) {
      const photo = await loadImage(profile.profile_photo_url).catch(() => null);
      if (photo) {
        const photoSize = 82;
        const photoX = qrX + 29;
        const photoY = 230;
        ctx.save();
        ctx.beginPath();
        ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(photo, photoX, photoY, photoSize, photoSize);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace';
    ctx.fillText(cardCode, 40, 285);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '14px Inter, sans-serif';
    ctx.fillText(`Valid until ${validUntil}`, 40, 318);
    const sub = profile.matric_number ? `Matric: ${profile.matric_number}` : profile.staff_id ? `Staff ID: ${profile.staff_id}` : '';
    if (sub) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '12px monospace'; ctx.fillText(sub, 40, 348); }
    return canvas;
  }

  async function downloadPNG() {
    setBusy(true);
    try {
      const c = await renderCanvas();
      if (!c) return;
      const a = document.createElement('a');
      a.download = `library-card-${cardCode}.png`;
      a.href = c.toDataURL('image/png'); a.click();
    } finally { setBusy(false); }
  }

  async function downloadPDF() {
    setBusy(true);
    try {
      const c = await renderCanvas();
      if (!c) return;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [c.width / 2, c.height / 2] });
      pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, c.width / 2, c.height / 2);
      pdf.save(`library-card-${cardCode}.pdf`);
    } finally { setBusy(false); }
  }

  async function printCard() {
    const c = await renderCanvas();
    if (!c) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Library Card</title></head><body style="margin:0;display:flex;justify-content:center;padding:40px"><img src="${c.toDataURL('image/png')}" style="max-width:100%"/></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const CardVisual = ({ scale = 1 }: { scale?: number }) => (
    <div
      ref={scale === 1 ? cardRef : undefined}
      className="relative rounded-3xl shadow-2xl overflow-hidden"
      style={{
        width: `${380 * scale}px`, height: `${220 * scale}px`,
        background: `linear-gradient(135deg, ${institutionConfig.primaryColour} 0%, ${institutionConfig.secondaryColour} 100%)`,
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute bottom-0 -left-8 w-24 h-24 rounded-full bg-white/5" />
      </div>
      <div className="absolute top-5 right-5 z-20 w-14 h-14 rounded-full border-2 border-white/80 bg-white/15 overflow-hidden flex items-center justify-center text-lg text-white/80">
        {profile.profile_photo_url ? <img src={profile.profile_photo_url} alt="" className="w-full h-full object-cover" /> : '👤'}
      </div>
      <div className="relative z-10 p-6 h-full flex flex-col justify-between text-white" style={{ fontSize: `${scale}rem` }}>
        <div>
          <p className="text-sm font-semibold mb-3 pr-16" style={{ color: '#C9A84C' }}>{institutionConfig.name}</p>
          <h2 className="text-2xl font-serif font-bold leading-tight mb-1">{cardName}</h2>
          <p className="text-sm text-white/80">{[profile.department, profile.faculty_name].filter(Boolean).join(' • ') || profile.institution}</p>
          <div className="inline-flex items-center mt-2 px-2.5 py-1 rounded-md bg-white/15 text-xs font-medium">{profile.patron_category}</div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-white/60 mb-1">{profile.library_number ? 'Library Number' : 'Reference'}</p>
            <p className="font-mono font-bold text-lg tracking-wide">{cardCode}</p>
            <p className="text-xs text-white/60 mt-2">Valid until {validUntil}</p>
            {profile.matric_number && <p className="text-xs text-white/50 mt-1 font-mono">Matric: {profile.matric_number}</p>}
            {profile.staff_id && <p className="text-xs text-white/50 mt-1 font-mono">Staff: {profile.staff_id}</p>}
          </div>
          <div className="bg-white p-2 rounded-xl shadow-lg">
            <QRCodeSVG value={cardCode} size={80 * scale} level="H" bgColor="#ffffff" fgColor={institutionConfig.primaryColour} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <BackButton />
          <h1 className="text-3xl font-serif font-semibold text-primary-800 mb-2">Digital Library Card</h1>
          <p className="text-neutral-500 text-sm">Present this card at the library desk for quick identification</p>
        </div>

        {!issued && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
            Your card is not active yet. Your Library Number will be assigned once your registration is approved.
          </div>
        )}

        <div className="flex justify-center mb-8"><CardVisual /></div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <button onClick={() => setShowModal(true)} className="btn-outline flex items-center justify-center gap-2">👁️ View</button>
          <button onClick={downloadPNG} disabled={busy} className="btn-primary flex items-center justify-center gap-2">{busy ? '…' : '⬇️ PNG'}</button>
          <button onClick={downloadPDF} disabled={busy} className="btn-outline flex items-center justify-center gap-2">{busy ? '…' : '📄 PDF'}</button>
          <button onClick={printCard} className="btn-outline flex items-center justify-center gap-2">🖨️ Print</button>
        </div>

        <div className="card p-6 mb-4">
          <h3 className="font-semibold text-neutral-800 mb-4">Card Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Detail label="Library Number" value={profile.library_number || 'Issued on approval'} mono />
            <Detail label="Category" value={profile.patron_category} />
            <Detail label="Faculty" value={profile.faculty_name || '—'} />
            {profile.department && <Detail label="Department" value={profile.department} />}
            {profile.current_level && <Detail label="Level" value={profile.current_level} />}
            {profile.institution && <Detail label="Institution" value={profile.institution} />}
            <Detail label="Valid Until" value={validUntil} />
          </div>
        </div>

        <HandbookSection />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-6">
            <CardVisual scale={1.6} />
            <button onClick={() => setShowModal(false)} className="px-6 py-2 rounded-lg bg-white text-neutral-800 font-semibold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function formatCardName(profile: { surname?: string | null; other_names?: string | null; full_name: string }) {
  if (profile.surname) return `${profile.surname.toUpperCase()}${profile.other_names ? `, ${profile.other_names}` : ''}`;
  const [first, ...rest] = profile.full_name.trim().split(/\s+/);
  return rest.length ? `${first.toUpperCase()}, ${rest.join(' ')}` : profile.full_name.toUpperCase();
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-medium text-neutral-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
