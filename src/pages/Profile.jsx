import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Bookmark,
  Calendar,
  Camera,
  ChevronRight,
  Crown,
  Download,
  Eye,
  Flame,
  KeyRound,
  ListPlus,
  LogOut,
  Pencil,
  Settings,
  Trash2,
  UserPlus,
} from 'lucide-react';
import '../styles/account.css';
import Header from '../components/Header.jsx';
import AvatarViewer from '../components/AvatarViewer.jsx';
import ProfileStats, { StatsSkeleton, useStats } from '../components/ProfileStats.jsx';
import Achievements, {
  AchievementsSkeleton,
  buildAchievements,
  levelFor,
  levelTitle,
} from '../components/Achievements.jsx';
import { AuthForm, NewPasswordScreen } from '../components/AuthForms.jsx';
import {
  ChangePasswordSheet,
  DeleteAccountSheet,
  EditNameSheet,
  PhotoSheet,
  SignOutSheet,
} from '../components/AccountSheets.jsx';
import useWatchlist from '../hooks/useWatchlist.js';
import useDownloads from '../services/downloadManager.js';
import { useMyLists, useWatched } from '../services/mylists.js';
import { openWelcome } from '../services/welcome.js';
import { imageUrl } from '../services/tmdb.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/profile.css';

/* Sheets and the toast are drawn on the app shell, so the bottom menu can never cover them */
const layer = (node) => {
  const shell = typeof document !== 'undefined' ? document.querySelector('.app-shell') : null;
  return shell ? createPortal(node, shell) : node;
};

/* The round photo. If the picture cannot load, the first letter stays. */
function Avatar({ url, initial }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <div className="avatar">
      <span>{initial}</span>
      {url && !broken && <img key={url} src={url} alt="" onError={() => setBroken(true)} />}
    </div>
  );
}

function ProfileSkeleton({ gear }) {
  return (
    <div className="page">
      <Header title="Profile" right={gear} />
      <div className="pf-hero" aria-busy="true">
        <div className="skeleton" style={{ width: 104, height: 104, borderRadius: '50%' }} />
        <div className="skeleton" style={{ width: 150, height: 22, marginTop: 18 }} />
        <div className="skeleton" style={{ width: 190, height: 14, marginTop: 10 }} />
        <div className="skeleton" style={{ width: 170, height: 28, marginTop: 14, borderRadius: 999 }} />
      </div>
      <div className="pf-tiles">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pf-tile">
            <div className="skeleton" style={{ width: 22, height: 22 }} />
            <div className="skeleton" style={{ width: 26, height: 18, marginTop: 8 }} />
            <div className="skeleton" style={{ width: 44, height: 10, marginTop: 8 }} />
          </div>
        ))}
      </div>
      <StatsSkeleton />
      <AchievementsSkeleton />
      <div className="card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="row">
            <div className="skeleton" style={{ width: 22, height: 22 }} />
            <div className="skeleton" style={{ flex: 1, height: 16 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const downloads = useDownloads();
  const watched = useWatched();
  const myLists = useMyLists();
  const { stats, loading: statsLoading } = useStats();
  const [sheet, setSheet] = useState(null); // 'name' | 'photo' | 'password' | 'delete' | 'signout'
  const [viewer, setViewer] = useState(false);
  const [farewell, setFarewell] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const downloadCount = downloads.items.filter((d) => d.status === 'completed').length;

  const achievements = useMemo(
    () =>
      buildAchievements({
        stats,
        watchlist: watchlist.length,
        lists: myLists.lists.length,
        downloads: downloadCount,
      }),
    [stats, watchlist.length, myLists.lists.length, downloadCount]
  );

  const recent = useMemo(
    () =>
      [...watched.items]
        .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
        .filter((w) => w.poster_path)
        .slice(0, 12),
    [watched.items]
  );

  const gear = (
    <button className="icon-btn" onClick={() => navigate('/settings')} aria-label="Settings">
      <Settings size={24} />
    </button>
  );

  if (loading) return <ProfileSkeleton gear={gear} />;

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
  const initial = name.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url || '';
  const verified = Boolean(user.email_confirmed_at);
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';
  const level = levelFor(stats);

  const doSignOut = async () => {
    await signOut();
    setSheet(null);
  };

  const doDelete = async () => {
    const err = await deleteAccount();
    if (!err) setFarewell('Your account was deleted. You can create a new one any time.');
    return err;
  };

  const close = (message) => (done) => {
    setSheet(null);
    if (done === true && message) showToast(message);
  };

  const openTitle = (item) => navigate(`/${item.media_type === 'tv' ? 'tv' : 'movie'}/${item.id}`);

  return (
    <div className="page">
      <Header title="Profile" right={gear} />

      <div className="pf-hero">
        <div className="pf-glow" aria-hidden="true" />
        <div className="avatar-wrap">
          <div
            className="avatar-ring"
            role="button"
            tabIndex={0}
            aria-label="View profile photo"
            onClick={() => setViewer(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setViewer(true);
            }}
          >
            <Avatar url={avatarUrl} initial={initial} />
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
        <div className="profile-email">
          {user.email}
          {verified && <BadgeCheck size={15} className="pf-verified" aria-label="Email confirmed" />}
        </div>

        <div className="pf-level">
          <Crown size={15} fill="currentColor" />
          <b>Level {level.level}</b>
          <span>{levelTitle(level.level)}</span>
        </div>
        <div
          className="pf-xp"
          role="progressbar"
          aria-valuenow={Math.round(level.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress to the next level"
        >
          <span style={{ width: `${Math.max(4, Math.round(level.progress * 100))}%` }} />
        </div>
        <div className="pf-xp-note">
          {level.toNext} XP to level {level.level + 1}
        </div>

        <div className="pf-chips">
          {stats.streak.current > 0 && (
            <span className="pf-chip hot">
              <Flame size={13} /> {stats.streak.current}-day streak
            </span>
          )}
          {memberSince && (
            <span className="pf-chip">
              <Calendar size={13} /> Member since {memberSince}
            </span>
          )}
        </div>
      </div>

      <div className="pf-tiles">
        <button className="pf-tile" onClick={() => navigate('/library')}>
          <Bookmark size={21} />
          <b>{watchlist.length}</b>
          <span>My List</span>
        </button>
        <button className="pf-tile" onClick={() => navigate('/library')}>
          <Eye size={21} />
          <b>{watched.items.length}</b>
          <span>Watched</span>
        </button>
        <button className="pf-tile" onClick={() => navigate('/library')}>
          <ListPlus size={21} />
          <b>{myLists.lists.length}</b>
          <span>Lists</span>
        </button>
        <button className="pf-tile" onClick={() => navigate('/downloads')}>
          <Download size={21} />
          <b>{downloadCount}</b>
          <span>Downloads</span>
        </button>
      </div>

      <ProfileStats onToast={showToast} />

      {statsLoading ? (
        <AchievementsSkeleton />
      ) : (
        <Achievements items={achievements} onToast={showToast} />
      )}

      {recent.length > 0 && (
        <section className="pf-recent" aria-label="Recently watched">
          <div className="pf-section-head">
            <h3>Recently watched</h3>
            <button type="button" onClick={() => navigate('/library')}>
              See all <ChevronRight size={15} />
            </button>
          </div>
          <div className="pf-rail">
            {recent.map((w) => (
              <button
                key={`${w.media_type}-${w.id}`}
                type="button"
                className="pf-poster"
                onClick={() => openTitle(w)}
                aria-label={w.title}
              >
                <img src={imageUrl(w.poster_path, 'w185')} alt="" loading="lazy" draggable="false" />
                <span>{w.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="section-label">Account</div>
      <div className="card">
        <button className="row" onClick={() => setSheet('name')}>
          <Pencil size={22} />
          <span className="row-label">Edit username</span>
          <span className="count pf-value">{name}</span>
          <ChevronRight size={18} className="muted" />
        </button>
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
        <button className="row" onClick={() => openWelcome('invite')}>
          <UserPlus size={22} />
          <span className="row-label">Invite friends</span>
          <ChevronRight size={18} className="muted" />
        </button>
      </div>

      <div className="profile-actions">
        <button className="pf-signout" onClick={() => setSheet('signout')}>
          <LogOut size={19} /> Sign out
        </button>
        <button className="pf-delete" onClick={() => setSheet('delete')}>
          <Trash2 size={16} /> Delete account
        </button>
      </div>

      {viewer &&
        layer(
          <AvatarViewer
            name={name}
            avatarUrl={avatarUrl}
            onClose={() => setViewer(false)}
            onChange={() => {
              setViewer(false);
              setSheet('photo');
            }}
          />
        )}

      {sheet === 'name' &&
        layer(
          <EditNameSheet
            current={name}
            onSave={updateUsername}
            onClose={close('Username updated')}
          />
        )}

      {sheet === 'photo' &&
        layer(
          <PhotoSheet
            hasPhoto={Boolean(avatarUrl)}
            initial={initial}
            onSave={uploadAvatar}
            onRemove={removeAvatar}
            onClose={close('Profile photo updated')}
          />
        )}

      {sheet === 'password' &&
        layer(<ChangePasswordSheet onSave={setPassword} onClose={close('Password changed')} />)}

      {sheet === 'signout' && layer(<SignOutSheet onConfirm={doSignOut} onClose={close()} />)}

      {sheet === 'delete' && layer(<DeleteAccountSheet onDelete={doDelete} onClose={close()} />)}

      {toast && layer(<div className="toast">{toast}</div>)}
    </div>
  );
        }
