import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function Header({ title, back = false, right = null }) {
  const navigate = useNavigate();
  return (
    <header className={`header ${back ? 'compact' : ''}`}>
      {back && (
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft size={26} />
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </header>
  );
}
