import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Play,
  Bookmark,
  BookmarkCheck,
  Share2,
  Star,
  Clock,
  Calendar,
  Tv,
  User,
  WifiOff,
  Bell,
  BellRing,
  Eye,
  ListPlus,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MovieRow from '../components/MovieRow.jsx';
import EpisodeList from '../components/EpisodeList.jsx';
import WhereToWatch from '../components/WhereToWatch.jsx';
import ListSheet from '../components/ListSheet.jsx';
import RemindSheet from '../components/RemindSheet.jsx';
import YourTake from '../components/YourTake.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import TrailerPlayer from '../components/TrailerPlayer.jsx';
import useWatchlist from '../hooks/useWatchlist.js';
import useLocalStorage from '../hooks/useLocalStorage.js';
import useDownloads, { getPlayableUrl } from '../services/downloadManager.js';
import { useWatched } from '../services/mylists.js';
import useReminders, {
  countdownText,
  followReleaseDate,
  formatDay,
  isUnreleased,
} from '../services/reminders.js';
import { FREE_FILMS, archivePage, loadFilm, searchFreeFilms } from '../services/archive.js';
import { tmdb, imageUrl, useMovies } from '../services/tmdb.js';
import { shareTitle } from '../services/links.js';
import { whenOnline } from '../services/connection.js';
import useOnline from '../hooks/useOnline.js';
import '../styles/details.css';
import '../styles/free.css';
import '../styles/series.css';
import '../styles/detailsbar.css';

function pickTrailer(videos = []) {
  const yt = videos.filter((v) => v.site === 'YouTube');
  return (
    yt.find((v) => v.type === 'Trailer' && v.official) ||
    yt.find((v) => v.type === 'Trailer') ||
    yt.find((v) => v.type === 'Teaser') ||
    null
  );
}

function formatRuntime(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

const STATUS = {
  'Returning Series': { label: 'Ongoing', live: true },
  'In Production': { label: 'In production', live: true },
  Planned: { label: 'Planned', live: false },
  Pilot: { label: 'Pilot', live: false },
  Ended: { label: 'Ended', live: false },
  Canceled: { label: 'Canceled', live: false },
};

/* Sheets, players and toasts are drawn on the app shell itself, so the bottom
   menu and the pinned buttons can never cover them. */
const layer = (node) => {
  const shell = typeof document !== 'undefined' ? document.querySelector('.app-shell') : null;
  return shell ? createPortal(node, shell) : node;
};

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const stripYear = (s) => s.replace(/\s\d{4}$/, '');

/* Looks for a free, public-domain copy of this exact movie (same title and
   release year). Returns a film with a playable address, or null. */
async function findFreeFilm(title, year) {
  try {
    const wanted = normalize(title);
    if (!wanted) return null;

    const curated = FREE_FILMS.find(
      (f) => normalize(f.title) === wanted && (!year || f.year === year)
    );
    let entry = curated || null;

    if (!entry && year) {
      const { films } = await searchFreeFilms({ term: title, rows: 24 });
      entry =
        films.find((f) => {
          const t = normalize(f.title);
          return (t === wanted || stripYear(t) === wanted) && f.year === year;
        }) || null;
    }
    if (!entry) return null;

    const film = await loadFilm(entry);
    return film.src ? film : null;
  } catch {
    return null;
  }
}

export default function MovieDetails({ kind = 'movie' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { has, toggle } = useWatchlist();
  const watched = useWatched();
  const reminders = useReminders();
  const online = useOnline();
  const [listOpen, setListOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const { items: downloads } = useDownloads();
  const [progress, setProgress] = useLocalStorage('nexushd:free-progress', {});
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [freePlayer, setFreePlayer] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const isTv = kind === 'tv';

  const details = useMovies(() => (isTv ? tmdb.tvDetails(id) : tmdb.details(id)), [id, kind]);
  const similar = useMovies(() => (isTv ? tmdb.tvSimilar(id) : tmdb.similar(id)), [id, kind]);

  const dTitle = details.data?.title;
  const dYear = details.data?.release_date ? Number(details.data.release_date.slice(0, 4)) : 0;
  const free = useMovies(
    () => (!isTv && dTitle ? findFreeFilm(dTitle, dYear) : Promise.resolve(null)),
    [dTitle, dYear, isTv]
  );

  const detailsData = details.data;
  // a release date can move: keep an existing reminder in step with it
  useEffect(() => {
    if (detailsData) followReleaseDate({ ...detailsData, media_type: kind });
  }, [detailsData, kind]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2000);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    document.querySelector('.app-content')?.scrollTo(0, 0);
    setExpanded(false);
    setTrailerOpen(false);
    setFreePlayer(null);
    setListOpen(false);
    setRemindOpen(false);
  }, [id, kind]);

  const playFree = async () => {
    const film = free.data;
    if (!film) return;
    const rec = downloads.find((d) => d.id === film.id);
    if (rec && rec.status === 'completed') {
      setFreePlayer({ film, src: null, loading: true, offline: true });
      try {
        const url = await getPlayableUrl(film.id);
        setFreePlayer({ film, src: url, loading: false, offline: true });
      } catch {
        setFreePlayer({ film, src: null, loading: false, offline: true });
      }
    } else {
      whenOnline(() => setFreePlayer({ film, src: film.src, loading: false, offline: false }));
    }
  };

  const closeFree = () => {
    if (freePlayer?.offline && freePlayer.src) URL.revokeObjectURL(freePlayer.src);
    setFreePlayer(null);
  };

  if (details.loading) {
    return (
      <div className="page">
        <div className="d-hero">
          <div className="skeleton d-hero-sk" />
          <button className="icon-btn d-back" onClick={back} aria-label="Back">
            <ChevronLeft size={26} />
          </button>
        </div>
        <div className="d-main">
          <div className="d-head">
            <div className="d-poster skeleton" />
            <div className="d-title-block">
              <div className="skeleton" style={{ height: 26, width: '90%' }} />
              <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '75%', marginTop: 10 }} />
            </div>
          </div>
          <div className="d-genres">
            {[70, 90, 80].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 28, width: w, borderRadius: 999 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 50, borderRadius: 14, marginTop: 20 }} />
          <div className="skeleton" style={{ height: 16, width: '40%', marginTop: 30 }} />
          <div className="skeleton" style={{ height: 14, marginTop: 14 }} />
          <div className="skeleton" style={{ height: 14, marginTop: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '70%', marginTop: 8 }} />
        </div>
      </div>
    );
  }

  if (details.error || !details.data) {
    return (
      <div className="page">
        <Header title="" back />
        <EmptyState
          icon={WifiOff}
          title={online ? `Couldn't load this ${isTv ? 'series' : 'movie'}` : 'No internet connection'}
          text={
            online
              ? 'Check your connection and try again.'
              : 'Connect to Wi-Fi or mobile data to open this.'
          }
          actionLabel="Try again"
          onAction={details.reload}
        />
      </div>
    );
  }

  const m = { ...details.data, media_type: kind };
  const trailer = pickTrailer(m.videos?.results);
  const cast = (m.credits?.cast || []).slice(0, 14);
  const year = m.release_date ? m.release_date.slice(0, 4) : '';
  const runtime = formatRuntime(m.runtime);
  const seasons = m.number_of_seasons || 0;
  const saved = has(m.id, kind);
  const unreleased = isUnreleased(m.release_date);
  const seen = watched.has(m.id, kind);
  const reminder = reminders.get(m.id, kind);
  const longText = (m.overview || '').length > 180;
  const heroImg = imageUrl(m.backdrop_path, 'w780') || imageUrl(m.poster_path, 'w500');
  const freeFilm = free.data;
  const status = isTv ? STATUS[m.status] : null;
  const network = isTv ? m.networks?.[0]?.name : '';
  const creators = isTv ? (m.created_by || []).map((c) => c.name).slice(0, 2).join(', ') : '';
  const episodeCount = isTv ? m.number_of_episodes || 0 : 0;

  const onToggleSave = () => {
    const added = toggle(m);
    showToast(added ? 'Added to My List' : 'Removed from My List');
  };

  const onToggleWatched = () => {
    const now = watched.toggle(m);
    showToast(now ? 'Marked as watched' : 'Removed from Watched');
  };

  const openTrailer = () => whenOnline(() => setTrailerOpen(true));

  const onShare = async () => {
    const result = await shareTitle(m, kind);
    if (result === 'copied') showToast('Link copied');
    else if (result === 'failed') showToast("Couldn't share this title");
  };

  return (
    <div className="page">
      <div className="d-hero">
        {heroImg && <img src={heroImg} alt="" />}
        <div className="d-hero-shade" />
        <button className="icon-btn d-back" onClick={back} aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <button className="icon-btn d-share" onClick={onShare} aria-label="Share">
          <Share2 size={22} />
        </button>
        {trailer && (
          <button className="d-play" onClick={openTrailer} aria-label="Play trailer">
            <Play size={28} fill="currentColor" />
          </button>
        )}
      </div>

      <div className="d-main">
        <div className="d-head">
          <div className="d-poster">
            {m.poster_path && <img src={imageUrl(m.poster_path, 'w342')} alt={m.title} />}
          </div>
          <div className="d-title-block">
            <h1>{m.title}</h1>
            {m.tagline && <p className="d-tagline">{m.tagline}</p>}
            <div className="d-facts">
              {m.vote_average > 0 && (
                <span>
                  <Star size={14} fill="currentColor" className="star" />
                  {m.vote_average.toFixed(1)}
                </span>
              )}
              {year && (
                <span>
                  <Calendar size={14} />
                  {year}
                </span>
              )}
              {runtime && (
                <span>
                  <Clock size={14} />
                  {runtime}
                </span>
              )}
              {unreleased && (
                <span className="ml-soon">
                  {formatDay(m.release_date)} · {countdownText(m.release_date)}
                </span>
              )}
              {isTv && seasons > 0 && (
                <span>
                  <Tv size={14} />
                  {seasons} {seasons === 1 ? 'season' : 'seasons'}
                  {episodeCount > 0 ? ` · ${episodeCount} episodes` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {m.genres?.length > 0 && (
          <div className="d-genres">
            {m.genres.map((g) => (
              <span key={g.id} className="d-genre">
                {g.name}
              </span>
            ))}
          </div>
        )}

        {isTv && (status || network || creators) && (
          <div className="tv-info">
            {status && <span className={`tv-badge ${status.live ? 'live' : ''}`}>{status.label}</span>}
            {network && <span>{network}</span>}
            {creators && <span>Created by {creators}</span>}
          </div>
        )}

        <WhereToWatch key={`${kind}-${m.id}`} kind={kind} id={m.id} />

        {!unreleased && <YourTake key={`${kind}-${m.id}`} movie={m} onToast={showToast} />}

        {isTv && (
          <EpisodeList
            key={m.id}
            tvId={m.id}
            seasons={m.seasons || []}
            nextEpisode={m.next_episode_to_air || null}
          />
        )}

        {m.overview && (
          <section className="d-section">
            <h2>Overview</h2>
            <p className={`d-overview ${longText && !expanded ? 'clamp' : ''}`}>{m.overview}</p>
            {longText && (
              <button className="d-more" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </section>
        )}

        {cast.length > 0 && (
          <section className="d-section">
            <h2>Cast</h2>
            <div className="cast-rail">
              {cast.map((c) => (
                <div className="cast" key={c.credit_id || c.id}>
                  <div className="cast-photo">
                    {c.profile_path ? (
                      <img src={imageUrl(c.profile_path, 'w185')} alt={c.name} loading="lazy" />
                    ) : (
                      <User size={26} />
                    )}
                  </div>
                  <div className="cast-name">{c.name}</div>
                  {c.character && <div className="cast-role">{c.character}</div>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <MovieRow
        title="More Like This"
        movies={similar.data?.results}
        loading={similar.loading}
        onOpen={(item) => navigate(`/${kind}/${item.id}`)}
      />

      <div className="d-bar">
        {freeFilm ? (
          <button className="btn-primary d-bar-main" onClick={playFree}>
            <Play size={20} fill="currentColor" /> Watch free film
          </button>
        ) : (
          <button className="btn-primary d-bar-main" disabled={!trailer} onClick={openTrailer}>
            <Play size={20} fill="currentColor" />
            {trailer ? 'Watch Trailer' : 'No trailer'}
          </button>
        )}
        {freeFilm && trailer && (
          <button className="d-bar-btn" onClick={openTrailer} aria-label="Watch trailer">
            <Tv size={22} />
          </button>
        )}
        <button
          className={`d-bar-btn ${saved ? 'on' : ''}`}
          onClick={onToggleSave}
          aria-label={saved ? 'Remove from My List' : 'Add to My List'}
          aria-pressed={saved}
        >
          {saved ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
        </button>
        <button className="d-bar-btn" onClick={() => setListOpen(true)} aria-label="Save to a list">
          <ListPlus size={22} />
        </button>
        {unreleased ? (
          <button
            className={`d-bar-btn ${reminder ? 'on' : ''}`}
            onClick={() => setRemindOpen(true)}
            aria-label={reminder ? 'Reminder on' : 'Remind me'}
            aria-pressed={Boolean(reminder)}
          >
            {reminder ? <BellRing size={22} /> : <Bell size={22} />}
          </button>
        ) : (
          <button
            className={`d-bar-btn ${seen ? 'on' : ''}`}
            onClick={onToggleWatched}
            aria-label={seen ? 'Watched' : 'Mark watched'}
            aria-pressed={seen}
          >
            <Eye size={22} />
          </button>
        )}
      </div>

      {trailerOpen &&
        trailer &&
        layer(
          <TrailerPlayer
            videoId={trailer.key}
            title={m.title}
            onClose={() => setTrailerOpen(false)}
          />
        )}

      {freePlayer &&
        layer(
          <VideoPlayer
            title={freePlayer.film.title}
            src={freePlayer.src}
            loading={freePlayer.loading}
            startAt={progress[freePlayer.film.id] || 0}
            fallbackHref={archivePage(freePlayer.film.id)}
            onClose={closeFree}
            onProgress={(s) => setProgress((prev) => ({ ...prev, [freePlayer.film.id]: s }))}
          />
        )}

      {listOpen &&
        layer(<ListSheet movie={m} onClose={() => setListOpen(false)} onToast={showToast} />)}

      {remindOpen &&
        layer(<RemindSheet movie={m} onClose={() => setRemindOpen(false)} onToast={showToast} />)}

      {toast && layer(<div className="toast">{toast}</div>)}
    </div>
  );
  }
