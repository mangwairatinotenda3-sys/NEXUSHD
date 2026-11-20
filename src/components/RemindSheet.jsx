import { useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import {
  OFFSETS,
  countdownText,
  fireTime,
  formatDay,
  formatFire,
  removeReminder,
  setReminder,
  useReminders,
} from '../services/reminders.js';
import '../styles/mylists.css';

const MESSAGES = {
  ok: (when) => `Reminder set for ${when}`,
  web: () => 'Saved. Alerts come in the Android app.',
  off: () => 'Turn on Notifications in Settings first',
  denied: () => 'Notifications are blocked. Allow them for NexusHD in Android settings.',
  past: () => 'That time has passed. Pick a later one.',
  nodate: () => "This title doesn't have a release date yet",
};

/* "Remind me": pick when the alert should come. */
export default function RemindSheet({ movie, onClose, onToast }) {
  const reminders = useReminders();
  const type = movie.media_type === 'tv' ? 'tv' : 'movie';
  const current = reminders.get(movie.id, type);
  const [offset, setOffset] = useState(current?.offset || 'day');
  const [busy, setBusy] = useState(false);
  const now = Date.now();

  const options = OFFSETS.map((o) => {
    const at = fireTime(movie.release_date, o.id);
    return { ...o, at, past: at === null || at <= now + 30000 };
  });
  const chosen = options.find((o) => o.id === offset);

  const save = async () => {
    if (busy || !chosen) return;
    setBusy(true);
    const result = await setReminder(movie, offset);
    setBusy(false);
    const text = (MESSAGES[result] || MESSAGES.denied)(chosen.at ? formatFire(chosen.at) : '');
    onToast?.(text);
    if (result === 'ok' || result === 'web') onClose();
  };

  const remove = async () => {
    await removeReminder(movie.id, type);
    onToast?.('Reminder removed');
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet ml-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Remind me</h3>
        <p className="ml-sheet-sub">
          {movie.title} · {formatDay(movie.release_date, true)}
          {countdownText(movie.release_date) ? ` · ${countdownText(movie.release_date)}` : ''}
        </p>

        <div className="ml-pick-list" role="radiogroup" aria-label="When to remind you">
          {options.map((o) => (
            <button
              key={o.id}
              className="ml-pick"
              role="radio"
              aria-checked={offset === o.id}
              disabled={o.past}
              onClick={() => setOffset(o.id)}
            >
              <span className="ml-pick-label">
                {o.label}
                <small>{o.at ? formatFire(o.at) : 'No date yet'}</small>
              </span>
              <span className={`ml-check round ${offset === o.id ? 'on' : ''}`}>
                {offset === o.id && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          ))}
        </div>

        <button className="btn-primary ml-done" onClick={save} disabled={busy || !chosen || chosen.past}>
          <Bell size={18} /> {current ? 'Update reminder' : 'Set reminder'}
        </button>
        {current && (
          <button className="ml-remove" onClick={remove}>
            <BellOff size={18} /> Remove reminder
          </button>
        )}
      </div>
    </div>
  );
}
