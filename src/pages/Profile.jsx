import { useState } from 'react';
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
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Too many attempts. Please wait a moment and try again.';
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

function AuthForm({ signIn, signUp }) {
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setFormError('');
    setInfo('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    setInfo('');

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
        if (error) setFormError(friendlyError(error));
      } else {
        const { data, error } = await signUp(email.trim(), password, username.trim());
        if (error) {
          setFormError(friendlyError(error));
        } else if (!data.session) {
          setInfo('Account created! Check your email to confirm it, then sign in.');
          setMode('signin');
          setPassword('');
        }
      }
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

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
          right={
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          }
        />

        <button className="btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

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

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, loading, signIn, signUp, signOut, updateUsername } = useAuth();
  const { items: watchlist } = useWatchlist();
  const [downloads] = useLocalStorage('nexushd:downloads', []);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);

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
        <div className="profile-actions">
          <div className="skeleton" style={{ height: 50, borderRadius: 14, marginTop: 16 }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <Header title="Profile" right={gear} />
        <AuthForm signIn={signIn} signUp={signUp} />
      </div>
    );
  }

  const name = profile?.username || user.user_metadata?.username || user.email.split('@')[0];

  const doSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setConfirmOut(false);
  };

  return (
    <div className="page">
      <Header title="Profile" right={gear} />

      <div className="profile-hero">
        <div className="avatar-ring">
          <div className="avatar">{name.charAt(0).toUpperCase()}</div>
        </div>
        <div className="profile-name">
          <span>{name}</span>
          <button className="icon-btn small" onClick={() => setEditing(true)} aria-label="Edit username">
            <Pencil size={16} />
          </button>
        </div>
        <div className="profile-email">{user.email}</div>
        <div className="profile-tag">
          Movie Lover <Crown size={16} fill="currentColor" />
        </div>
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

      <div className="profile-actions">
        <button className="btn-primary" onClick={() => setConfirmOut(true)}>
          Sign Out
        </button>
      </div>

      {editing && (
        <EditNameSheet current={name} onSave={updateUsername} onClose={() => setEditing(false)} />
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
    </div>
  );
  }
