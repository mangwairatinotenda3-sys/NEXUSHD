import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2, Users } from 'lucide-react';
import { shareLink } from '../services/share.js';
import { INVITE_TEXT, INVITE_URL } from '../services/welcome.js';
import '../styles/onboarding.css';

export default function InviteSheet({ onClose }) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flashCopied = () => {
    setCopied(true);
    setNote('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  };

  const share = async () => {
    const result = await shareLink({ title: 'NexusHD', text: INVITE_TEXT, url: INVITE_URL });
    if (result === 'copied') flashCopied();
    else if (result === 'failed') setNote('Sharing is not available here. Copy the link instead.');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INVITE_URL);
      flashCopied();
    } catch {
      setNote('Could not copy. Press and hold the link to copy it.');
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet invite-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="invite-icon">
          <Users size={28} />
        </div>
        <h3>Invite your friends</h3>
        <p>Send them the link and they can install NexusHD on their Android phone in a minute.</p>

        <button type="button" className="invite-link" onClick={copy} aria-label="Copy invite link">
          <span className="invite-url">{INVITE_URL.replace('https://', '')}</span>
          <span className={`invite-copy ${copied ? 'done' : ''}`}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>

        {note && <div className="invite-note">{note}</div>}

        <div className="sheet-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="primary" onClick={share}>
            <Share2 size={18} /> Share
          </button>
        </div>
      </div>
    </div>
  );
    }
