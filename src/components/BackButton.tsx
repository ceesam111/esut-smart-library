import { useNavigate } from 'react-router-dom';

export default function BackButton({ label = 'Back' }: { label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors duration-150"
      style={{ color: '#6B1D2A', background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer' }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#D4A017')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#6B1D2A')}
    >
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      {label}
    </button>
  );
}
