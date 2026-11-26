import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import BrandMark from './BrandMark.jsx';
import '../styles/profile.css';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const NAME_HINT = '3–20 letters, numbers or underscores';

const LAST_EMAIL_KEY = 'nexushd:last-email';
const NO_CONNECTION = 'No connection. Check your internet and try again.';

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const readLastEmail = () => {
  try {
    return window.localStorage.getItem(LAST_EMAIL_KEY) || '';
  } catch {
    return '';
  }
};

const saveLastEmail = (email) => {
  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, email);
  } catch {
    /* storage unavailable */
  }
};

/* Turns an error from the server into a sentence a person can act on */
export function friendlyError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (error?.code === '23505' || msg.includes('duplicate key') || msg.includes('already taken'))
    return 'That username is taken. Try another one.';
  if (msg.includes('database error'))
    return 'We could not create this account. That username may already be taken, so try another one.';
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
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to load'))
    return NO_CONNECTION;
  if (msg.includes('password') && error?.message) return error.message;
  return 'Something went wrong. Please try again.';
}

/* How strong a password is: 1 (weak) to 4 (strong) */
export function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '' };
  if (pw.length < 6) return { score: 1, label: 'Too short' };
  let points = 1;
  if (pw.length >= 10) points += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points += 1;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) points += 1;
  const score = Math.min(4, points);
  return { score, label: ['', 'Weak', 'Okay', 'Good', 'Strong'][score] };
}

export function PasswordStrength({ value }) {
  const { score, label } = passwordStrength(value);
  if (!value) return null;
  return (
    <div className={`pw-meter s${score}`} aria-live="polite">
      <div className="pw-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={n <= score ? 'on' : ''} />
        ))}
      </div>
      <span className="pw-label">{label}</span>
    </div>
  );
}

export function Field({ label, icon: Icon, error, right, ...inputProps }) {
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

export function PasswordToggle({ shown, onToggle }) {
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
    if (offline()) {
      setFormError(NO_CONNECTION);
      return;
    }
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

export function AuthForm({
  signIn,
  signUp,
  resendConfirmation,
  requestPasswordReset,
  initialInfo,
  initialError,
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(readLastEmail);
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

    if (offline()) {
      setFormError(NO_CONNECTION);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setFormError(friendlyError(error));
          if ((error.message || '').toLowerCase().includes('not confirmed')) setNeedsConfirm(true);
        } else {
          saveLastEmail(email.trim());
        }
      } else {
        const { data, error } = await signUp(email.trim(), password, username.trim());
        if (error) {
          setFormError(friendlyError(error));
        } else if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // the server answers like this when the email already has an account
          setFormError('An account with this email already exists. Try signing in.');
        } else if (!data?.session) {
          saveLastEmail(email.trim());
          setInfo('Account created! Check your email to confirm it, then sign in.');
          setMode('signin');
          setNeedsConfirm(true);
          setPassword('');
        } else {
          saveLastEmail(email.trim());
        }
      }
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: 'Enter your email address first' });
      return;
    }
    if (offline()) {
      setFormError(NO_CONNECTION);
      return;
    }
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
        <p>Sign in to keep your lists, ratings and settings with your account.</p>
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
        {mode === 'signup' && <PasswordStrength value={password} />}

        {mode === 'signin' && (
          <button type="button" className="auth-link right" onClick={() => switchMode('forgot')}>
            Forgot password?
          </button>
        )}

        <button className="btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {mode === 'signup' && (
          <p className="auth-legal">
            By creating an account you agree to the{' '}
            <button type="button" onClick={() => navigate('/legal/terms')}>
              Terms of Use
            </button>{' '}
            and{' '}
            <button type="button" onClick={() => navigate('/legal/privacy')}>
              Privacy Policy
            </button>
            .
          </p>
        )}
      </form>
    </div>
  );
}

/* ---------- New password (from the reset link) ---------- */

export function NewPasswordScreen({ onSave, onCancel }) {
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
    if (offline()) {
      setFormError(NO_CONNECTION);
      return;
    }
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
