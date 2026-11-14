import {
  Download,
  Film,
  Play,
  ScreenShare,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import '../styles/onboarding.css';

const ICONS = {
  play: Play,
  rotate: ScreenShare,
  download: Download,
  film: Film,
  shield: ShieldCheck,
  users: Users,
};

export default function WhatsNew({ release, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet news-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="invite-icon">
          <Sparkles size={28} />
        </div>
        <h3>What's new</h3>
        <p className="news-sub">
          Version {release.version} · {release.title}
        </p>

        <ul className="news-list">
          {release.highlights.map((h) => {
            const Icon = ICONS[h.icon] || Sparkles;
            return (
              <li key={h.title}>
                <span className="news-ico">
                  <Icon size={19} />
                </span>
                <span className="news-text">
                  <b>{h.title}</b>
                  <span>{h.text}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <button type="button" className="btn-primary news-done" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
      }
