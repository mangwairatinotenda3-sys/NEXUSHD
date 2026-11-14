import { Capacitor } from '@capacitor/core';

/* "New version available" for the Android app.
   Every Android build made by GitHub Actions is numbered ("Build 12") in its
   release notes. The app knows its own build number (VITE_BUILD, set by the
   workflow) and compares it with the newest release.
   - Signed release builds (VITE_CHANNEL=release) follow the newest public
     release of the repository.
   - Test builds follow the "android-latest" test release. */

export const APP_VERSION = import.meta.env.VITE_VERSION || '1.1.0';
export const BUILD = Number(import.meta.env.VITE_BUILD) || 0;

const REPO = 'mangwairatinotenda3-sys/NEXUSHD';
const TAG = 'android-latest';
const RELEASE_CHANNEL = import.meta.env.VITE_CHANNEL === 'release';
const ENDPOINT = RELEASE_CHANNEL
  ? `https://api.github.com/repos/${REPO}/releases/latest`
  : `https://api.github.com/repos/${REPO}/releases/tags/${TAG}`;

const CHECK_KEY = RELEASE_CHANNEL ? 'nexushd:update-check-release' : 'nexushd:update-check';
const DISMISSED_KEY = 'nexushd:update-dismissed';
const EVERY_MS = 6 * 60 * 60 * 1000;

// only the installed Android app can update itself
export const updatesSupported = () => Capacitor.isNativePlatform() && BUILD > 0;

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

export const dismissedBuild = () => Number(read(DISMISSED_KEY)) || 0;
export const dismissBuild = (build) => write(DISMISSED_KEY, build);

const answer = (latest) => ({
  available: Boolean(latest && latest.build > BUILD && latest.url),
  build: latest?.build || 0,
  version: latest?.version || '',
  url: latest?.url || '',
  size: latest?.size || 0,
});

/* Asks GitHub for the newest build. Without force, it asks at most every six
   hours and otherwise answers from the last check. Throws if offline. */
export async function checkForUpdate({ force = false } = {}) {
  const saved = read(CHECK_KEY);
  if (!force && saved && Date.now() - saved.checkedAt < EVERY_MS) return answer(saved);

  const res = await fetch(ENDPOINT, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error('Could not check for updates');
  const release = await res.json();

  // the release notes start with "Build 12", so the first match is the build
  const text = `${release.name || ''} ${release.body || ''}`;
  const build = Number((/build\s*(\d+)/i.exec(text) || [])[1]) || 0;
  const apk = (release.assets || []).find((a) => /\.apk$/i.test(a.name));
  const version = (/(\d+\.\d+\.\d+)/.exec(release.name || release.tag_name || '') || [])[1] || '';

  const latest = {
    build,
    version,
    url: apk?.browser_download_url || '',
    size: apk?.size || 0,
    checkedAt: Date.now(),
  };
  write(CHECK_KEY, latest);
  return answer(latest);
   }
