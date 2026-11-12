import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Bookmark,
  Download,
  LayoutGrid,
  ChevronRight,
  Crown,
  Pencil,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Camera,
  KeyRound,
  Trash2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import BrandMark from '../components/BrandMark.jsx';
import useWatchlist from '../hooks/useWatchlist.js';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/account.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const NAME_HINT = '3–20 letters, numbers or underscores';

function friendlyError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('invalid login')) return 'Wrong email or password.';
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'An account with this email already exists. Try signing in.';
  if (msg.includes('email not confirmed')) return 'Please confirm your email first, then sign in.';
  if (msg.includes('security purposes'))
    return 'Please wait a minute before asking for another email.';
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (msg.includes('token') || msg.includes('otp') || msg.includes('expired'))
    return 'This link has expired. Ask for a new one.';
  if (msg.includes('different from'))
    return 'Choose a password you are not using already.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'No connection. Check your internet and try again.';
  if (msg.includes('password') && error?.message) return error.message;
  return 'Something went wrong. Please try again.';
}

function Field({ label, icon: Icon, error, right, ...inputProps }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className={`field-box ${error ? 'bad' : ''}`}>
        <Icon size={19} />
        <input aria-label={label} {...inputProps} />
        {right}
      </div>
      {error && <div className="field-hint">{error}</div>}
    </div>
  );
}

function PasswordToggle({ shown, onToggle }) {
  return (
    <button
      type="button"
      className="pw-toggle"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
    >
      {shown ? <EyeOff size={19} /> : <Eye size={19} />}
    </button>
  );
}

/* Cooldown so the same email is not requested over and over */
function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

/* ---------- Forgot password (emails a reset link) ---------- */

function ForgotForm({ initialEmail, onBack, requestPasswordReset }) {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useCooldown();

  const send = async (e) => {
    e?.preventDefault();
    if (busy || cooldown > 0) return;
    setFormError('');
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    setError('');
    setBusy(true);
    const err = await requestPasswordReset(email.trim());
    setBusy(false);
    if (err) {
      setFormError(friendlyError(err));
      return;
    }
    setCooldown(45);
    setSent(true);
  };

  return (
    <div className="auth-wrap">
      <button type="button" className="auth-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to sign in
      </button>

      <div className="auth-brand">
        <div className="auth-icon">{sent ? <Mail size={28} /> : <KeyRound size={28} />}</div>
        <h2>{sent ? 'Check your email' : 'Forgot your password?'}</h2>
        <p>
          {sent
            ? `We sent a link to ${email.trim()}. Open it on this phone and you can choose a new password. Check your spam folder if it does not arrive.`
            : 'Enter your email and we will send you a link to set a new password.'}
        </p>
      </div>

      {formError && (
        <div className="form-error" role="alert">
          <AlertCircle size={18} />
          <span>{formError}</span>
        </div>
      )}

      {sent ? (
        <>
          <button
            type="button"
            className="btn-primary auth-submit"
            onClick={send}
            disabled={busy || cooldown > 0}
          >
            {busy ? 'Sending…' : cooldown > 0 ? `Send another email in ${cooldown}s` : 'Send another email'}
          </button>
          <button type="button" className="auth-link center" onClick={onBack}>
            Back to sign in
          </button>
        </>
      ) : (
        <form onSubmit={send} noValidate>
          <Field
            label="Email"
            icon={Mail}
            error={error}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
          <button className="btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------- Sign in / create account ---------- */

function AuthForm({
  signIn,
  signUp,
  resendConfirmation,
  requestPasswordReset,
  initialInfo,
  initialError,
}) {
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(initialError || '');
  const [info, setInfo] = useState(initialInfo || '');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useCooldown();

  // the message after deleting an account arrives just after this form appears
  useEffect(() => {
    if (initialInfo) setInfo(initialInfo);
  }, [initialInfo]);

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setFormError('');
    setInfo('');
    setNeedsConfirm(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    setInfo('');
    setNeedsConfirm(false);

    const next = {};
    if (mode === 'signup' && !NAME_RE.test(username.trim())) next.username = NAME_HINT;
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address';
    if (password.length < 6) next.password = 'At least 6 characters';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setFormError(friendlyError(error));
          if ((error.message || '').toLowerCase().includes('not confirmed')) setNeedsConfirm(true);
        }
      } else {
        const { data, error } = await signUp(email.trim(), password, username.trim());
        if (error) {
          setFormError(friendlyError(error));
        } else if (!data.session) {
          setInfo('Account created! Check your email to confirm it, then sign in.');
          setMode('signin');
          setNeedsConfirm(true);
          setPassword('');
        }
      }
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || !EMAIL_RE.test(email.trim())) return;
    const error = await resendConfirmation(email.trim());
    if (error) {
      setFormError(friendlyError(error));
    } else {
      setFormError('');
      setInfo('Confirmation email sent. Check your inbox and spam folder.');
      setCooldown(45);
    }
  };

  if (mode === 'forgot') {
    return (
      <ForgotForm
        initialEmail={email}
        onBack={() => switchMode('signin')}
        requestPasswordReset={requestPasswordReset}
      />
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <BrandMark size={56} />
        <h2>Welcome to NexusHD</h2>
        <p>Sign in to keep your list and settings with your account.</p>
      </div>

      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className={mode === 'signin' ? 'on' : ''}
          onClick={() => switchMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'on' : ''}
          onClick={() => switchMode('signup')}
        >
          Create account
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        {info && (
          <div className="form-info" role="status">
            <CheckCircle2 size={18} />
            <span>{info}</span>
          </div>
        )}
        {formError && (
          <div className="form-error" role="alert">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}
        {needsConfirm && (
          <button
            type="button"
            className="auth-link"
            style={{ marginBottom: 14 }}
            onClick={resend}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `Resend confirmation email in ${cooldown}s` : 'Resend confirmation email'}
          </button>
        )}

        {mode === 'signup' && (
          <Field
            label="Username"
            icon={User}
            error={errors.username}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="movie_lover"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        )}
        <Field
          label="Email"
          icon={Mail}
          error={errors.email}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Field
          label="Password"
          icon={Lock}
          error={errors.password}
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          right={<PasswordToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />}
        />

        {mode === 'signin' && (
          <button type="button" className="auth-link right" onClick={() => switchMode('forgot')}>
            Forgot password?
          </button>
        )}

        <button className="btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

/* ---------- New password (from the reset link) ---------- */

function NewPasswordScreen({ onSave, onCancel }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    const next = {};
    if (password.length < 6) next.password = 'At least 6 characters';
    if (confirm !== password) next.confirm = 'The passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const error = await onSave(password);
    setBusy(false);
    if (error) setFormError(friendlyError(error));
  };

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <div className="auth-icon">
          <KeyRound size={28} />
        </div>
        <h2>Set a new password</h2>
        <p>Choose a new password for your NexusHD account.</p>
      </div>
      <form onSubmit={submit} noValidate>
        {formError && (
          <div className="form-error" role="alert">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}
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
        <button className="btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
        <button type="button" className="auth-link center" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </form>
    </div>
  );
            }

/* ---------- Sheets ---------- */

function EditNameSheet({ current, onSave, onClose }) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const v = value.trim();
    if (!NAME_RE.test(v)) {
      setError(NAME_HINT);
      return;
    }
    if (v === current) {
      onClose();
      return;
    }
    setBusy(true);
    const err = await onSave(v);
    setBusy(false);
    if (err) setError('Could not save. Please try again.');
    else onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h3>Edit username</h3>
        <p>This is the name shown on your profile.</p>
        <Field
          label="Username"
          icon={User}
          error={error}
          value={value}
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
          <button type="button" onClick={onClose}>
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

function ChangePasswordSheet({ onSave, onClose }) {
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
        {formError && (
          <div className="form-error" role="alert">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}
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
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process this image'))), 'image/jpeg', 0.86)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoSheet({ hasPhoto, initial, onSave, onRemove, onClose }) {
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
    setBusy(true);
    const err = await onSave(preview.blob);
    setBusy(false);
    if (err) setError('Could not upload the photo. Please try again.');
    else onClose();
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const err = await onRemove();
    setBusy(false);
    if (err) setError('Could not remove the photo. Please try again.');
    else onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Profile photo</h3>
        <p>{preview ? 'Looks good? It will be shown as a circle.' : 'Pick a photo from your gallery.'}</p>

        <div className="photo-preview">
          {preview ? (
            <img src={preview.url} alt="New profile" />
          ) : (
            <span>{initial}</span>
          )}
        </div>

        {error && (
          <div className="form-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

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
        <button type="button" className="sheet-cancel" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeleteAccountSheet({ onDelete, onClose }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = text.trim().toUpperCase() === 'DELETE';

  const go = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const err = await onDelete();
    if (err) {
      setBusy(false);
      setError('Could not delete the account. Check your connection and try again.');
    }
  };

  return (
    <div className="sheet-backdrop" onClick={() => !busy && onClose()}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={go}>
        <h3>Delete your account?</h3>
        <p>
          This permanently deletes your profile, your photo and your saved list, on every device.
          Downloads stored on this phone are not affected. This cannot be undone.
        </p>
        {error && (
          <div className="form-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
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
          <button type="button" onClick={onClose} disabled={busy}>
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

/* ---------- Page ---------- */

export default function Profile() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    loading,
    recovering,
    linkError,
    signIn,
    signUp,
    signOut,
    resendConfirmation,
    requestPasswordReset,
    setPassword,
    cancelRecovery,
    updateUsername,
    uploadAvatar,
    removeAvatar,
    deleteAccount,
  } = useAuth();
  const { items: watchlist } = useWatchlist();
  const [downloads] = useLocalStorage('nexushd:downloads', []);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sheet, setSheet] = useState(null); // 'name' | 'photo' | 'password' | 'delete'
  const [farewell, setFarewell] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const gear = (
    <button className="icon-btn" onClick={() => navigate('/settings')} aria-label="Settings">
      <Settings size={24} />
    </button>
  );

  if (loading) {
    return (
      <div className="page">
        <Header title="Profile" right={gear} />
        <div className="profile-hero">
          <div className="skeleton" style={{ width: 104, height: 104, borderRadius: '50%' }} />
          <div className="skeleton" style={{ width: 150, height: 22, marginTop: 18 }} />
          <div className="skeleton" style={{ width: 100, height: 14, marginTop: 10 }} />
        </div>
        <div className="card">
          {[0, 1, 2].map((i) => (
            <div key={i} className="row">
              <div className="skeleton" style={{ width: 22, height: 22 }} />
              <div className="skeleton" style={{ flex: 1, height: 16 }} />
            </div>
          ))}
        </div>
        <div className="card">
          {[0, 1].map((i) => (
            <div key={i} className="row">
              <div className="skeleton" style={{ width: 22, height: 22 }} />
              <div className="skeleton" style={{ flex: 1, height: 16 }} />
            </div>
          ))}
        </div>
        <div className="profile-actions">
          <div className="skeleton" style={{ height: 50, borderRadius: 14, marginTop: 16 }} />
        </div>
      </div>
    );
  }

  if (user && recovering) {
    return (
      <div className="page">
        <Header title="Profile" right={gear} />
        <NewPasswordScreen onSave={setPassword} onCancel={cancelRecovery} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <Header title="Profile" right={gear} />
        <AuthForm
          signIn={signIn}
          signUp={signUp}
          resendConfirmation={resendConfirmation}
          requestPasswordReset={requestPasswordReset}
          initialInfo={farewell}
          initialError={linkError}
        />
      </div>
    );
  }

  const name = profile?.username || user.user_metadata?.username || user.email.split('@')[0];
  const avatarUrl = profile?.avatar_url || '';
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';

  const doSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setConfirmOut(false);
  };

  const doDelete = async () => {
    const err = await deleteAccount();
    if (!err) setFarewell('Your account was deleted. You can create a new one any time.');
    return err;
  };

  return (
    <div className="page">
      <Header title="Profile" right={gear} />

      <div className="profile-hero">
        <div className="avatar-wrap">
          <div className="avatar-ring">
            <div className="avatar">
              <span>{name.charAt(0).toUpperCase()}</span>
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>
          </div>
          <button
            className="avatar-edit"
            onClick={() => setSheet('photo')}
            aria-label="Change profile photo"
          >
            <Camera size={16} />
          </button>
        </div>
        <div className="profile-name">
          <span>{name}</span>
          <button className="icon-btn small" onClick={() => setSheet('name')} aria-label="Edit username">
            <Pencil size={16} />
          </button>
        </div>
        <div className="profile-email">{user.email}</div>
        <div className="profile-tag">
          Movie Lover <Crown size={16} fill="currentColor" />
        </div>
        {memberSince && <div className="profile-since">Member since {memberSince}</div>}
      </div>

      <div className="card">
        <button className="row" onClick={() => navigate('/library')}>
          <Bookmark size={22} />
          <span className="row-label">My Watchlist</span>
          <span className="count">{watchlist.length}</span>
          <ChevronRight size={18} className="muted" />
        </button>
        <button className="row" onClick={() => navigate('/downloads')}>
          <Download size={22} />
          <span className="row-label">My Downloads</span>
          <span className="count">{downloads.length}</span>
          <ChevronRight size={18} className="muted" />
        </button>
        <button className="row" onClick={() => navigate('/library')}>
          <LayoutGrid size={22} />
          <span className="row-label">My Library</span>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <div className="section-label">Account</div>
      <div className="card">
        <button className="row" onClick={() => setSheet('photo')}>
          <Camera size={22} />
          <span className="row-label">Profile photo</span>
          <ChevronRight size={18} className="muted" />
        </button>
        <button className="row" onClick={() => setSheet('password')}>
          <KeyRound size={22} />
          <span className="row-label">Change password</span>
          <ChevronRight size={18} className="muted" />
        </button>
        <button className="row danger-row" onClick={() => setSheet('delete')}>
          <Trash2 size={22} />
          <span className="row-label">Delete account</span>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <div className="profile-actions">
        <button className="btn-primary" onClick={() => setConfirmOut(true)}>
          Sign Out
        </button>
      </div>

      {sheet === 'name' && (
        <EditNameSheet current={name} onSave={updateUsername} onClose={() => setSheet(null)} />
      )}

      {sheet === 'photo' && (
        <PhotoSheet
          hasPhoto={Boolean(avatarUrl)}
          initial={name.charAt(0).toUpperCase()}
          onSave={uploadAvatar}
          onRemove={removeAvatar}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'password' && (
        <ChangePasswordSheet
          onSave={setPassword}
          onClose={(saved) => {
            setSheet(null);
            if (saved) showToast('Password changed');
          }}
        />
      )}

      {sheet === 'delete' && (
        <DeleteAccountSheet onDelete={doDelete} onClose={() => setSheet(null)} />
      )}

      {confirmOut && (
        <div className="sheet-backdrop" onClick={() => !signingOut && setConfirmOut(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Sign out?</h3>
            <p>You can sign back in any time with your email and password.</p>
            <div className="sheet-actions">
              <button onClick={() => setConfirmOut(false)} disabled={signingOut}>
                Cancel
              </button>
              <button className="danger" onClick={doSignOut} disabled={signingOut}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
    }
