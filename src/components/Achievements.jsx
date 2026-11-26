import {
  Award,
  Bookmark,
  Check,
  Clock,
  Download,
  Eye,
  Film,
  Flame,
  ListPlus,
  Lock,
  Medal,
  Star,
  Trophy,
} from 'lucide-react';
import '../styles/profile.css';

/* Your level grows with what you watch, rate and finish. It is worked out from
   your own stats on this phone and your account lists, nothing is sent anywhere. */
export function levelFor(stats) {
  const xp = Math.round(stats.titles * 10 + stats.hours * 5 + stats.ratedCount * 3);
  const level = Math.floor(Math.sqrt(xp / 20)) + 1;
  const start = 20 * (level - 1) ** 2;
  const next = 20 * level ** 2;
  return {
    xp,
    level,
    toNext: Math.max(0, next - xp),
    progress: Math.max(0, Math.min(1, (xp - start) / (next - start))),
  };
}

/* A short title for the level, for the line under your name */
export function levelTitle(level) {
  if (level >= 12) return 'Movie legend';
  if (level >= 8) return 'Cinephile';
  if (level >= 5) return 'Movie buff';
  if (level >= 3) return 'Regular';
  if (level >= 2) return 'Movie fan';
  return 'Newcomer';
}

export function buildAchievements({ stats, watchlist, lists, downloads }) {
  return [
    {
      id: 'first',
      icon: Film,
      title: 'First watch',
      hint: 'Mark a title as watched, or finish a free film.',
      value: stats.titles,
      target: 1,
    },
    {
      id: 'ten',
      icon: Eye,
      title: 'Ten titles',
      hint: 'Watch 10 titles.',
      value: stats.titles,
      target: 10,
    },
    {
      id: 'fifty',
      icon: Trophy,
      title: 'Fifty titles',
      hint: 'Watch 50 titles.',
      value: stats.titles,
      target: 50,
    },
    {
      id: 'critic',
      icon: Star,
      title: 'Critic',
      hint: 'Rate 5 titles.',
      value: stats.ratedCount,
      target: 5,
    },
    {
      id: 'fan',
      icon: Award,
      title: 'Five-star fan',
      hint: 'Give 3 titles five stars.',
      value: stats.fiveStars,
      target: 3,
    },
    {
      id: 'streak3',
      icon: Flame,
      title: 'Hat-trick',
      hint: 'Watch 3 days in a row.',
      value: stats.streak.best,
      target: 3,
    },
    {
      id: 'streak7',
      icon: Medal,
      title: 'Week streak',
      hint: 'Watch 7 days in a row.',
      value: stats.streak.best,
      target: 7,
    },
    {
      id: 'marathon',
      icon: Clock,
      title: 'Marathoner',
      hint: 'Watch 24 hours of film.',
      value: Math.floor(stats.hours),
      target: 24,
    },
    {
      id: 'collector',
      icon: Bookmark,
      title: 'Collector',
      hint: 'Save 10 titles to My List.',
      value: watchlist,
      target: 10,
    },
    {
      id: 'curator',
      icon: ListPlus,
      title: 'Curator',
      hint: 'Make 3 lists of your own.',
      value: lists,
      target: 3,
    },
    {
      id: 'offline',
      icon: Download,
      title: 'Offline ready',
      hint: 'Download a film to watch offline.',
      value: downloads,
      target: 1,
    },
  ].map((a) => ({ ...a, done: a.value >= a.target }));
}

export function AchievementsSkeleton() {
  return (
    <div className="ach" aria-hidden="true">
      <div className="ach-head">
        <div className="skeleton" style={{ width: 120, height: 18 }} />
      </div>
      <div className="ach-rail">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ach-tile">
            <div className="skeleton" style={{ width: 46, height: 46, borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: 62, height: 12, marginTop: 10 }} />
            <div className="skeleton" style={{ width: 54, height: 6, marginTop: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Achievements({ items, onToast }) {
  const unlocked = items.filter((a) => a.done).length;
  // unlocked ones first, then the ones closest to being done
  const sorted = [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? -1 : 1;
    return b.value / b.target - a.value / a.target;
  });

  const tap = (a) => {
    if (a.done) onToast?.(`${a.title} unlocked`);
    else onToast?.(`${a.hint} (${Math.min(a.value, a.target)} of ${a.target})`);
  };

  return (
    <section className="ach" aria-label="Achievements">
      <div className="ach-head">
        <h3>Achievements</h3>
        <span>
          {unlocked} of {items.length}
        </span>
      </div>
      <div className="ach-rail">
        {sorted.map((a) => {
          const Icon = a.icon;
          const pct = Math.round(Math.min(1, a.value / a.target) * 100);
          return (
            <button
              key={a.id}
              type="button"
              className={`ach-tile ${a.done ? 'done' : ''}`}
              onClick={() => tap(a)}
              aria-label={`${a.title}, ${a.done ? 'unlocked' : `${pct} percent`}`}
            >
              <span className="ach-icon">
                <Icon size={22} />
                <i>{a.done ? <Check size={11} strokeWidth={3.2} /> : <Lock size={10} strokeWidth={3} />}</i>
              </span>
              <b>{a.title}</b>
              {a.done ? (
                <em>Unlocked</em>
              ) : (
                <span className="ach-bar">
                  <span style={{ width: `${Math.max(6, pct)}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
      }
