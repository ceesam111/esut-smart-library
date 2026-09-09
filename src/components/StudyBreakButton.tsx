import { useLocation, useNavigate } from 'react-router-dom';

/**
 * "Take a Study Break" button — links to the Wellbeing Corner games and
 * remembers the current page so the user can "Return to Reading" afterwards.
 */
export default function StudyBreakButton({
  className = '',
  label = 'Take a Study Break',
}: {
  className?: string;
  label?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const go = () => {
    sessionStorage.setItem('studyBreakReturn', location.pathname + location.search);
    navigate('/wellbeing?tab=games');
  };

  return (
    <button onClick={go} className={`btn-outline ${className}`}>
      <span aria-hidden>🧘</span>
      {label}
    </button>
  );
}
