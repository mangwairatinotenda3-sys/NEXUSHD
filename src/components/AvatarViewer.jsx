import { Camera, X } from 'lucide-react';
import '../styles/avatarviewer.css';

/* Full-size view of the profile picture. Tap anywhere (or Android Back) to close. */
export default function AvatarViewer({ name, avatarUrl, onClose, onChange }) {
  return (
    <div className="sheet-backdrop avatar-viewer" onClick={onClose}>
      <button type="button" className="av-close" onClick={onClose} aria-label="Close">
        <X size={22} />
      </button>

      <div className="av-photo" onClick={(e) => e.stopPropagation()}>
        <span>{name.charAt(0).toUpperCase()}</span>
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={`${name}'s profile picture`}
            draggable="false"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>

      <div className="av-name">{name}</div>

      <button
        type="button"
        className="av-change"
        onClick={(e) => {
          e.stopPropagation();
          onChange();
        }}
      >
        <Camera size={18} />
        {avatarUrl ? 'Change photo' : 'Add a photo'}
      </button>
    </div>
  );
      }
