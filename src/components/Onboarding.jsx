import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  CloudOff,
  Download,
  Eye,
  Film,
  Pause,
  Play,
  Search,
  Share2,
  Star,
  Users,
  Wifi,
  Youtube,
} from 'lucide-react';
import BrandMark from './BrandMark.jsx';
import { BACK_EVENT } from '../services/welcome.js';
import '../styles/onboarding.css';

const COUNT = 5;

/* Five welcome screens: what NexusHD is, where to watch, downloads, your lists, invite. */
export default function Onboarding({ onDone, onInvite }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const last = index === COUNT - 1;

  const go = (next) => setIndex(Math.max(0, Math.min(COUNT - 1, next)));

  // Android Back steps back one screen instead of leaving the app
  useEffect(() => {
    const onBack = () => setIndex((i) => Math.max(0, i - 1));
    window.addEventListener(BACK_EVENT, onBack);
    return () => window.removeEventListener(BACK_EVENT, onBack);
  }, []);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, locked: null };
  };

  const onTouchMove = (e) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (s.locked !== 'x') return;
    setDragging(true);
    // a little resistance at the first and last screen
    const atEdge = (index === 0 && dx > 0) || (last && dx < 0);
    setDrag(atEdge ? dx * 0.25 : dx);
  };

  const onTouchEnd = () => {
    const s = start.current;
    start.current = null;
    if (s?.locked === 'x') {
      if (drag < -55) go(index + 1);
      else if (drag > 55) go(index - 1);
    }
    setDrag(0);
    setDragging(false);
  };

  const slide = (i) => `onb-slide ${index === i ? 'active' : ''}`;

  return (
    <div className="onb" role="dialog" aria-modal="true" aria-label="Welcome to NexusHD">
      {Array.from({ length: COUNT }, (_, i) => (
        <span key={i} className={`onb-glow g${i} ${index === i ? 'on' : ''}`} aria-hidden="true" />
      ))}

      <div className="onb-top">
        <div className="onb-steps" aria-hidden="true">
          {Array.from({ length: COUNT }, (_, i) => (
            <span key={i} className={i <= index ? 'on' : ''} />
          ))}
        </div>
        <button
          type="button"
          className={`onb-skip ${last ? 'hide' : ''}`}
          onClick={onDone}
          tabIndex={last ? -1 : 0}
        >
          Skip
        </button>
      </div>

      <div
        className="onb-viewport"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className={`onb-track ${dragging ? 'dragging' : ''}`}
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))` }}
        >
          {/* 1 · Welcome */}
          <section className={slide(0)} aria-hidden={index !== 0}>
            <div className="onb-stage">
              <span className="onb-ring r1" />
              <span className="onb-ring r2" />
              <div className="onb-fan">
                <span className="onb-poster p1">
                  <Film size={30} />
                </span>
                <span className="onb-poster p3">
                  <Star size={30} />
                </span>
                <span className="onb-poster p2">
                  <BrandMark size={64} />
                </span>
              </div>
            </div>
            <h2>Movies and series, all in one place</h2>
            <p>
              Find what to watch next, play free films and keep everything you love in your pocket.
            </p>
            <div className="onb-chips">
              <span>
                <Search size={15} /> Discover
              </span>
              <span>
                <Play size={15} /> Watch
              </span>
              <span>
                <Download size={15} /> Download
              </span>
            </div>
          </section>

          {/* 2 · Where to watch */}
          <section className={slide(1)} aria-hidden={index !== 1}>
            <h2 className="tight">Know where to watch</h2>
            <p>Every title tells you what you can do with it.</p>
            <div className="onb-cards">
              <div className="onb-card">
                <span className="onb-card-ico">
                  <Youtube size={22} />
                </span>
                <div>
                  <b>Trailers</b>
                  <span>Watch the trailer of any movie or series before you decide.</span>
                </div>
              </div>
              <div className="onb-card">
                <span className="onb-card-ico">
                  <Film size={22} />
                </span>
                <div>
                  <b>Free Films</b>
                  <span>Classic public domain films play right inside the app, with subtitles.</span>
                </div>
              </div>
              <div className="onb-card">
                <span className="onb-card-ico">
                  <CloudOff size={22} />
                </span>
                <div>
                  <b>Offline</b>
                  <span>Download a free film and watch it with no internet.</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3 · Downloads */}
          <section className={slide(2)} aria-hidden={index !== 2}>
            <div className="onb-dl" aria-hidden="true">
              <div className="onb-dl-row">
                <span className="onb-dl-thumb">
                  <Film size={22} />
                </span>
                <div className="onb-dl-text">
                  <b>Your film</b>
                  <span>Downloading · 18 MB/s · 2 min left</span>
                </div>
                <span className="onb-dl-btn">
                  <Pause size={17} fill="currentColor" />
                </span>
              </div>
              <div className="onb-dl-bar">
                <span />
              </div>
              <div className="onb-dl-done">
                <span className="onb-dl-check">
                  <Check size={13} strokeWidth={3.2} />
                </span>
                Ready to watch offline
              </div>
            </div>
            <h2>Download and watch anywhere</h2>
            <p>Save free films to your phone. Pause and resume any time, even after a bad connection.</p>
            <div className="onb-chips">
              <span>
                <Wifi size={15} /> Wi-Fi only option
              </span>
              <span>
                <Play size={15} /> Resumes by itself
              </span>
            </div>
          </section>

          {/* 4 · Lists */}
          <section className={slide(3)} aria-hidden={index !== 3}>
            <div className="onb-lists" aria-hidden="true">
              <div className="onb-list-tile t1">
                <span className="ico">
                  <Bookmark size={20} />
                </span>
                <b>My List</b>
                <span>12 titles</span>
              </div>
              <div className="onb-list-tile t2">
                <span className="ico">
                  <Eye size={20} />
                </span>
                <b>Watched</b>
                <span>48 titles</span>
              </div>
              <div className="onb-list-tile t3">
                <span className="ico">🍿</span>
                <b>Weekend picks</b>
                <span className="onb-rate">
                  <Star size={12} fill="currentColor" />
                  <Star size={12} fill="currentColor" />
                  <Star size={12} fill="currentColor" />
                  <Star size={12} fill="currentColor" />
                  <Star size={12} />
                </span>
              </div>
            </div>
            <h2>Your lists, your ratings</h2>
            <p>
              Make lists like “Weekend picks”, mark what you have watched and rate it. Sign in and it
              all follows you to any phone.
            </p>
          </section>

          {/* 5 · Invite */}
          <section className={slide(4)} aria-hidden={index !== 4}>
            <div className="onb-stage small">
              <span className="onb-ring r1" />
              <span className="onb-ring r2" />
              <div className="onb-badge">
                <Users size={44} />
              </div>
            </div>
            <h2>Better with friends</h2>
            <p>Know someone who loves movies? Send them NexusHD, it only takes one tap.</p>
            <button type="button" className="onb-ghost" onClick={onInvite}>
              <Share2 size={18} /> Invite friends
            </button>
          </section>
        </div>
      </div>

      <div className="onb-bottom">
        <div className="onb-actions">
          <button
            type="button"
            className={`onb-back ${index === 0 ? 'hide' : ''}`}
            onClick={() => go(index - 1)}
            tabIndex={index === 0 ? -1 : 0}
          >
            Back
          </button>
          <button
            type="button"
            className="btn-primary onb-next"
            onClick={() => (last ? onDone() : go(index + 1))}
          >
            {last ? 'Get started' : 'Next'}
            <ArrowRight size={19} />
          </button>
        </div>
      </div>
    </div>
  );
         }
