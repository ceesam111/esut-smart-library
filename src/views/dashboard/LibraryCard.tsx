import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface PatronData {
  id: string;
  full_name: string;
  patron_id: string;
  matric_number: string | null;
  staff_id: string | null;
  faculty_name: string;
  department: string | null;
  patron_category: string;
  membership_expires_at: string;
}

export default function LibraryCard() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [patron, setPatron] = useState<PatronData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchPatronData();
  }, [navigate]);

  const fetchPatronData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('patrons')
        .select('id, full_name, patron_id, matric_number, staff_id, faculty_name, department, patron_category, membership_expires_at')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setPatron(data);
    } catch (error) {
      console.error('Error fetching patron:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCardAsImage = async () => {
    if (!cardRef.current || !patron) return;

    setExporting(true);
    try {
      // Create canvas from the card
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 680;
      canvas.height = 400;

      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, institutionConfig.primaryColour);
      gradient.addColorStop(1, institutionConfig.secondaryColour);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(0, 0, canvas.width, canvas.height, 24);
      ctx.fill();

      // Institution name (gold)
      ctx.fillStyle = '#C9A84C';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillText(institutionConfig.name, 40, 50);

      // Patron name (large white)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Playfair Display, serif';
      ctx.fillText(patron.full_name, 40, 110);

      // Department and Faculty
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '16px Inter, sans-serif';
      const deptFaculty = [patron.department, patron.faculty_name].filter(Boolean).join(' • ');
      ctx.fillText(deptFaculty || patron.faculty_name || '', 40, 145);

      // Category badge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(40, 165, 140, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(patron.patron_category, 52, 184);

      // QR Code area (right side)
      const qrSize = 140;
      const qrX = canvas.width - qrSize - 40;
      const qrY = 60;

      // QR background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12);
      ctx.fill();

      // Generate QR code to canvas
      const qrCanvas = document.createElement('canvas');
      await new Promise<void>((resolve) => {
        QRCode.toCanvas(qrCanvas, patron.patron_id, {
          width: qrSize,
          margin: 0,
          color: { dark: institutionConfig.primaryColour, light: '#ffffff' },
        }, () => resolve());
      });
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // Patron ID (JetBrains Mono)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px JetBrains Mono, monospace';
      ctx.fillText(patron.patron_id, 40, 280);

      // Valid until
      const validDate = new Date(patron.membership_expires_at);
      const validStr = `Valid until ${validDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(validStr, 40, 315);

      // Matric number (for students)
      if (patron.matric_number) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.fillText(`Matric: ${patron.matric_number}`, 40, 350);
      }

      // Staff ID (for staff)
      if (patron.staff_id) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.fillText(`Staff ID: ${patron.staff_id}`, 40, 350);
      }

      // Download
      const link = document.createElement('a');
      link.download = `library-card-${patron.patron_id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">Loading your library card...</p>
        </div>
      </div>
    );
  }

  if (!patron) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="card p-8 text-center max-w-md">
          <div className="text-5xl mb-4">📇</div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Library Card Not Found</h2>
          <p className="text-neutral-500 text-sm mb-6">
            We couldn't find your library card. Please complete registration first.
          </p>
          <button onClick={() => navigate('/register')} className="btn-primary">
            Register Now
          </button>
        </div>
      </div>
    );
  }

  const validUntil = new Date(patron.membership_expires_at).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-semibold text-primary-800 mb-2">
            Smart Library Card
          </h1>
          <p className="text-neutral-500 text-sm">
            Present this card at the library desk for quick identification
          </p>
        </div>

        {/* Premium Library Card */}
        <div ref={cardRef} className="flex justify-center mb-8">
          <div
            className="relative rounded-3xl shadow-2xl overflow-hidden"
            style={{
              width: '380px',
              height: '220px',
              background: `linear-gradient(135deg, ${institutionConfig.primaryColour} 0%, ${institutionConfig.secondaryColour} 100%)`,
            }}
          >
            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white/5" />
              <div className="absolute bottom-0 -left-8 w-24 h-24 rounded-full bg-white/5" />
            </div>

            {/* Card content */}
            <div className="relative z-10 p-6 h-full flex flex-col justify-between text-white">
              {/* Top section */}
              <div>
                <p
                  className="text-sm font-semibold mb-3"
                  style={{ color: '#C9A84C' }}
                >
                  {institutionConfig.name}
                </p>
                <h2 className="text-2xl font-serif font-bold leading-tight mb-1">
                  {patron.full_name}
                </h2>
                <p className="text-sm text-white/80">
                  {[patron.department, patron.faculty_name].filter(Boolean).join(' • ')}
                </p>
                <div className="inline-flex items-center mt-2 px-2.5 py-1 rounded-md bg-white/15 text-xs font-medium">
                  {patron.patron_category}
                </div>
              </div>

              {/* Bottom section */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-white/60 mb-1">Patron ID</p>
                  <p className="font-mono font-bold text-lg tracking-wide">
                    {patron.patron_id}
                  </p>
                  <p className="text-xs text-white/60 mt-2">Valid until {validUntil}</p>
                  {patron.matric_number && (
                    <p className="text-xs text-white/50 mt-1 font-mono">
                      Matric: {patron.matric_number}
                    </p>
                  )}
                  {patron.staff_id && (
                    <p className="text-xs text-white/50 mt-1 font-mono">
                      Staff: {patron.staff_id}
                    </p>
                  )}
                </div>

                {/* QR Code */}
                <div className="bg-white p-2 rounded-xl shadow-lg">
                  <QRCodeSVG
                    value={patron.patron_id}
                    size={80}
                    level="H"
                    bgColor="#ffffff"
                    fgColor={institutionConfig.primaryColour}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={exportCardAsImage}
            disabled={exporting}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Saving...' : 'Save as Image'}
          </button>
          <button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: 'Smart Library Card',
                    text: `${patron.full_name} - ${patron.patron_id}`,
                  });
                } catch {}
              } else {
                await navigator.clipboard.writeText(patron.patron_id);
                alert('Patron ID copied to clipboard');
              }
            }}
            className="btn-outline flex-1 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 000-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            Share
          </button>
        </div>

        {/* Card Details */}
        <div className="card p-6">
          <h3 className="font-semibold text-neutral-800 mb-4">Card Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Patron ID</p>
              <p className="font-mono font-semibold text-neutral-800">{patron.patron_id}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Category</p>
              <p className="font-medium text-neutral-800">{patron.patron_category}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Faculty</p>
              <p className="font-medium text-neutral-800">{patron.faculty_name}</p>
            </div>
            {patron.department && (
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Department</p>
                <p className="font-medium text-neutral-800">{patron.department}</p>
              </div>
            )}
            {patron.matric_number && (
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Matric Number</p>
                <p className="font-mono font-medium text-neutral-800">{patron.matric_number}</p>
              </div>
            )}
            {patron.staff_id && (
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Staff ID</p>
                <p className="font-mono font-medium text-neutral-800">{patron.staff_id}</p>
              </div>
            )}
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Valid Until</p>
              <p className="font-medium text-neutral-800">{validUntil}</p>
            </div>
          </div>
        </div>

        {/* Borrowing Privileges */}
        <div className="card p-6 mt-4">
          <h3 className="font-semibold text-neutral-800 mb-4">Your Borrowing Privileges</h3>
          {(() => {
            const categoryKey = patron.patron_category.toLowerCase().replace(/ /g, '_') as keyof typeof institutionConfig.loanRules;
            const rules = institutionConfig.loanRules[categoryKey] || institutionConfig.loanRules.undergraduate;
            return (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-primary-50 rounded-lg">
                  <p className="text-2xl font-bold text-primary-700">{rules.maxItems}</p>
                  <p className="text-xs text-neutral-500">Max Items</p>
                </div>
                <div className="p-3 bg-primary-50 rounded-lg">
                  <p className="text-2xl font-bold text-primary-700">{rules.durationDays}</p>
                  <p className="text-xs text-neutral-500">Days per Loan</p>
                </div>
                <div className="p-3 bg-primary-50 rounded-lg">
                  <p className="text-2xl font-bold text-primary-700">{rules.renewals}×</p>
                  <p className="text-xs text-neutral-500">Renewals</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
