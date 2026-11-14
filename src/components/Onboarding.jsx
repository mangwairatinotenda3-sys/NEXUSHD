import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  CloudOff,
  Download,
  Film,
  Play,
  Search,
  Share2,
  Users,
  Youtube,
} from 'lucide-react';
import BrandMark from './BrandMark.jsx';
import { BACK_EVENT } from '../services/welcome.js';
import '../styles/onboarding.css';

const COUNT = 4;

/* Four welcome screens: what NexusHD is, where to watch, your library, invite. */
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

  return (
    <div className="onb" role="dialog" aria-modal="true" aria-label="Welcome to NexusHD">
      <div className="onb-top">
        {!last && (
          <button type="button" className="onb-skip" onClick={onDone}>
            Skip
          </button>
        )}
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
          <section className="onb-slide" aria-hidden={index !== 0}>
            <div className="onb-art">
              <span className="onb-ring r1" />
              <span className="onb-ring r2" />
              <BrandMark size={96} />
            </div>
            <h2>Welcome to NexusHD</h2>
            <p>
              Find your next movie or series, watch trailers, play free films and keep everything you
              love in one place.
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
          <section className="onb-slide" aria-hidden={index !== 1}>
            <h2 className="tight">Where to watch</h2>
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
                  <span>Download a free film on the Android app and watch it with no internet.</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3 · Library */}
          <section className="onb-slide" aria-hidden={index !== 2}>
            <div className="onb-art square">
              <span className="onb-ring r1" />
              <div className="onb-badge">
                <Bookmark size={44} />
              </div>
            </div>
            <h2>Your list, everywhere</h2>
            <p>
              Save titles to your watchlist and pick up where you stopped. Sign in and your list
              follows you to any phone.
            </p>
          </section>

          {/* 4 · Invite */}
          <section className="onb-slide" aria-hidden={index !== 3}>
            <div className="onb-art square">
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
        <div className="onb-dots" role="tablist" aria-label="Welcome screens">
          {Array.from({ length: COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Screen ${i + 1} of ${COUNT}`}
              className={i === index ? 'on' : ''}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className="btn-primary onb-next" onClick={() => (last ? onDone() : go(index + 1))}>
          {last ? 'Get started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
