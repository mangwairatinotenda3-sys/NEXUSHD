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
