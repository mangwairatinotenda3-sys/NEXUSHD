import { APP_VERSION } from './update.js';

/* First-run welcome, "What's new" and invite-friends bits that are shared by
   the app shell and Settings. Everything is stored on the phone only. */

const SEEN_KEY = 'nexushd:onboarded';
const VERSION_KEY = 'nexushd:last-version';
const EVENT = 'nexushd:welcome';

export const INVITE_URL = 'https://mangwairatinotenda3-sys.github.io/NEXUSHD/get.html';
export const INVITE_TEXT =
  'I use NexusHD to find movies and series, watch trailers and free films, and download films to watch offline. Get the app:';

const read = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

export const hasOnboarded = () => read(SEEN_KEY) === true;

export const markOnboarded = () => {
  write(SEEN_KEY, true);
  write(VERSION_KEY, APP_VERSION);
};

export const lastSeenVersion = () => read(VERSION_KEY);
export const markVersionSeen = () => write(VERSION_KEY, APP_VERSION);

/* Newest first. `icon` is looked up in WhatsNew.jsx. Add a new entry here for
   each release that should show the "What's new" sheet once. */
export const RELEASES = [
  {
    version: '1.1.0',
    title: 'A better player, faster downloads',
    highlights: [
      {
        icon: 'play',
        title: 'New video player',
        text: 'Double-tap to jump 10 seconds, drag to seek, change speed and lock the controls.',
      },
      {
        icon: 'rotate',
        title: 'Rotate and fill the screen',
        text: 'Films open in landscape. Switch between Fit and Fill, or rotate any time.',
      },
      {
        icon: 'download',
        title: 'Downloads that keep going',
        text: 'Downloads in the Android app now resume after a bad connection and show real progress.',
      },
      {
        icon: 'film',
        title: 'Free Films page fixed',
        text: 'The Play and Download buttons stay in view, and the tab bar steps aside while you watch.',
      },
      {
        icon: 'shield',
        title: 'Privacy and terms',
        text: 'Read how NexusHD handles your information in Settings. Updates are now signed.',
      },
      {
        icon: 'users',
        title: 'Invite friends',
        text: 'Share NexusHD with one tap from Settings.',
      },
    ],
  },
];

export const releaseFor = (version) => RELEASES.find((r) => r.version === version) || null;

/* Lets Settings open the welcome tour, the news sheet, the invite sheet or the feedback sheet,
   which live in the app shell. what: 'welcome' | 'news' | 'invite' | 'feedback' */
export const openWelcome = (what) =>
  window.dispatchEvent(new CustomEvent(EVENT, { detail: what }));

export const onWelcomeEvent = (fn) => {
  const handler = (e) => fn(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};

/* Android Back while the tour is open steps back through the slides */
export const BACK_EVENT = 'nexushd:back';
