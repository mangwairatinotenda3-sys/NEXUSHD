import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, Mail, MessageSquare } from 'lucide-react';
import {
  FEEDBACK_EMAIL,
  KINDS,
  buildMailto,
  buildMessage,
} from '../services/feedback.js';
import '../styles/feedback.css';

const MIN = 10;
const MAX = 1500;

export default function FeedbackSheet({ onClose }) {
  const [kind, setKind] = useState('bug');
  const [message, setMessage] = useState('');
  const [includeInfo, setIncludeInfo] = useState(true);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('form'); // 'form' | 'sent'
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const send = (e) => {
    e.preventDefault();
    if (message.trim().length < MIN) {
      setError(`Please write at least ${MIN} characters so we can understand.`);
      return;
    }
    setError('');
    setStage('sent');
    window.location.href = buildMailto({ kind, message, includeInfo });
  };

  const copy = async () => {
    const { subject, body } = buildMessage({ kind, message, includeInfo });
    const text = `To: ${FEEDBACK_EMAIL}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Could not copy. Please email us at ' + FEEDBACK_EMAIL);
    }
  };

  if (stage === 'sent') {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="sheet fb-sheet center" onClick={(e) => e.stopPropagation()}>
          <div className="fb-icon">
            <Mail size={28} />
          </div>
          <h3>Almost done</h3>
          <p>
            Your email app should now be open with your message ready. Press <b>Send</b> there.
            Nothing opened? Copy the message and email it to {FEEDBACK_EMAIL}.
          </p>
          {error && (
            <div className="form-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          <div className="sheet-actions">
            <button type="button" onClick={copy}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied' : 'Copy message'}
            </button>
            <button type="button" className="primary" onClick={onClose}>
              Done
            </button>
          </div>
          <button type="button" className="fb-back" onClick={() => setStage('form')}>
            Edit my message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet fb-sheet" onClick={(e) => e.stopPropagation()} onSubmit={send} noValidate>
        <div className="fb-head">
          <span className="fb-icon small">
            <MessageSquare size={22} />
          </span>
          <div>
            <h3>Send feedback</h3>
            <p>Tell us what is not working or what you would love to see.</p>
          </div>
        </div>

        <div className="fb-kinds" role="radiogroup" aria-label="Type of feedback">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              className={kind === k.id ? 'on' : ''}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <textarea
          className={`fb-text ${error ? 'bad' : ''}`}
          aria-label="Your message"
          value={message}
          maxLength={MAX}
          rows={5}
          placeholder={
            kind === 'bug'
              ? 'What happened, and what were you doing?'
              : kind === 'idea'
                ? 'What would make NexusHD better for you?'
                : 'Write your message here'
          }
          onChange={(e) => {
            setMessage(e.target.value);
            setError('');
          }}
        />
        <div className="fb-meta">
          <span className="fb-error">{error}</span>
          <span>
            {message.length}/{MAX}
          </span>
        </div>

        <button
          type="button"
          className="fb-check"
          role="switch"
          aria-checked={includeInfo}
          onClick={() => setIncludeInfo(!includeInfo)}
        >
          <span className="fb-check-text">
            <b>Include phone details</b>
            <span>App version and Android version, to help fix bugs. Nothing personal.</span>
          </span>
          <span className={`switch ${includeInfo ? 'on' : ''}`} />
        </button>

        <div className="sheet-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            <Mail size={18} /> Send
          </button>
        </div>
      </form>
    </div>
  );
}
