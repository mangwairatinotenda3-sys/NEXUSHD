import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Lock, Trash2, User } from 'lucide-react';
import {
  Field,
  NAME_HINT,
  NAME_RE,
  PasswordStrength,
  PasswordToggle,
  friendlyError,
} from './AuthForms.jsx';
import '../styles/profile.css';

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const NO_CONNECTION = 'No connection. Check your internet and try again.';

function ErrorBox({ text }) {
  if (!text) return null;
  return (
    <div className="form-error" role="alert">
      <AlertCircle size={18} />
      <span>{text}</span>
    </div>
  );
}

/* ---------- Username ---------- */

export function EditNameSheet({ current, onSave, onClose }) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = value.trim();
    // nothing changed: just close (a name made from an email may not follow the rules below)
    if (v === current) {
      onClose();
      return;
    }
    if (!NAME_RE.test(v)) {
      setError(NAME_HINT);
      return;
    }
    if (offline()) {
      setError(NO_CONNECTION);
      return;
    }
    setBusy(true);
    const err = await onSave(v);
    setBusy(false);
    if (err) setError(friendlyError(err));
    else onClose(true);
  };

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save} noValidate>
        <h3>Edit username</h3>
        <p>This is the name shown on your profile.</p>
        <Field
          label="Username"
          icon={User}
          error={error}
          value={value}
          maxLength={20}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="sheet-actions">
          <button type="button" onClick={() => onClose()} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Password ---------- */

export function ChangePasswordSheet({ onSave, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    const next = {};
    if (password.length < 6) next.password = 'At least 6 characters';
    if (confirm !== password) next.confirm = 'The passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;
    if (offline()) {
      setFormError(NO_CONNECTION);
      return;
    }
    setBusy(true);
    const error = await onSave(password);
    setBusy(false);
    if (error) setFormError(friendlyError(error));
    else onClose(true);
  };

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save} noValidate>
        <h3>Change password</h3>
        <p>You stay signed in on this phone.</p>
        <ErrorBox text={formError} />
        <Field
          label="New password"
          icon={Lock}
          error={errors.password}
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          autoComplete="new-password"
          autoFocus
          right={<PasswordToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />}
        />
        <PasswordStrength value={password} />
        <Field
          label="Confirm new password"
          icon={Lock}
          error={errors.confirm}
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
          autoComplete="new-password"
        />
        <div className="sheet-actions">
          <button type="button" onClick={() => onClose()} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Photo ---------- */

/* Crops the picked photo to a square and shrinks it, so uploads are small */
async function toSquareJpeg(file, size = 320) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read this image'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not process this image'))),
        'image/jpeg',
        0.86
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoSheet({ hasPhoto, initial, onSave, onRemove, onClose }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => preview && URL.revokeObjectURL(preview.url), [preview]);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('That photo is too large. Choose one under 20 MB.');
      return;
    }
    try {
      const blob = await toSquareJpeg(file);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async () => {
    if (!preview || busy) return;
    if (offline()) {
      setError(NO_CONNECTION);
      return;
    }
    setBusy(true);
    setError('');
    const err = await onSave(preview.blob);
    setBusy(false);
    if (err) setError('Could not upload the photo. Please try again.');
    else onClose(true);
  };

  const remove = async () => {
    if (busy) return;
    if (offline()) {
      setError(NO_CONNECTION);
      return;
    }
    setBusy(true);
    setError('');
    const err = await onRemove();
    setBusy(false);
    if (err) setError('Could not remove the photo. Please try again.');
    else onClose(true);
  };

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Profile photo</h3>
        <p>{preview ? 'Looks good? It will be shown as a circle.' : 'Pick a photo from your gallery.'}</p>

        <div className="photo-preview">
          {preview ? <img src={preview.url} alt="New profile" /> : <span>{initial}</span>}
        </div>

        <ErrorBox text={error} />

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />

        {preview ? (
          <div className="sheet-actions">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
              Choose another
            </button>
            <button type="button" className="primary" onClick={save} disabled={busy}>
              {busy ? 'Uploading…' : 'Save photo'}
            </button>
          </div>
        ) : (
          <div className="sheet-actions">
            {hasPhoto && (
              <button type="button" className="danger" onClick={remove} disabled={busy}>
                {busy ? 'Removing…' : 'Remove'}
              </button>
            )}
            <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
              Choose photo
            </button>
          </div>
        )}
        <button type="button" className="sheet-cancel" onClick={() => onClose()} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------- Sign out ---------- */

export function SignOutSheet({ onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Sign out?</h3>
        <p>
          Your lists and ratings stay safe in your account. You can sign back in any time with your
          email and password.
        </p>
        <div className="sheet-actions">
          <button type="button" onClick={() => onClose()} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={go} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Delete account ---------- */

export function DeleteAccountSheet({ onDelete, onClose }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = text.trim().toUpperCase() === 'DELETE';

  const go = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    if (offline()) {
      setError(NO_CONNECTION);
      return;
    }
    setBusy(true);
    setError('');
    const err = await onDelete();
    if (err) {
      setBusy(false);
      setError('Could not delete the account. Check your connection and try again.');
    }
  };

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={go} noValidate>
        <h3>Delete your account?</h3>
        <p>
          This permanently deletes your profile, your photo, your lists, ratings and saved titles, on
          every device. Downloads stored on this phone are not affected. This cannot be undone.
        </p>
        <ErrorBox text={error} />
        <Field
          label="Type DELETE to confirm"
          icon={Trash2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="DELETE"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="sheet-actions">
          <button type="button" onClick={() => onClose()} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="danger" disabled={!ready || busy}>
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </form>
    </div>
  );
}
