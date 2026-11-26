import { useSyncExternalStore } from 'react';

/* How the video player behaves: normal speed, how subtitles look, whether it
   remembers where you stopped, and how far the skip buttons jump. Kept on this
   phone. Changing one takes effect in the player straight away. */

const KEY = 'nexushd:player-prefs';

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const SKIPS = [5, 10, 15, 30];

export const SUB_SIZES = [
  { id: 's', label: 'Small', scale: 0.8 },
  { id: 'm', label: 'Medium', scale: 1 },
  { id: 'l', label: 'Large', scale: 1.3 },
  { id: 'xl', label: 'Huge', scale: 1.65 },
];

export const SUB_COLORS = [
  { id: 'white', label: 'White', value: '#ffffff' },
  { id: 'yellow', label: 'Yellow', value: '#ffd84d' },
  { id: 'cyan', label: 'Cyan', value: '#7df0ff' },
  { id: 'green', label: 'Green', value: '#8dff9c' },
];

export const SUB_BACKS = [
  { id: 'shadow', label: 'Shadow' },
  { id: 'box', label: 'Box' },
  { id: 'plain', label: 'Plain' },
];

export const DEFAULTS = {
  speed: 1,
  subSize: 'm',
  subColor: 'white',
  subBack: 'shadow',
  remember: true,
  skip: 10,
};

const clean = (v) => {
  const out = { ...DEFAULTS };
  if (SPEEDS.includes(v?.speed)) out.speed = v.speed;
  if (SUB_SIZES.some((s) => s.id === v?.subSize)) out.subSize = v.subSize;
  if (SUB_COLORS.some((c) => c.id === v?.subColor)) out.subColor = v.subColor;
  if (SUB_BACKS.some((b) => b.id === v?.subBack)) out.subBack = v.subBack;
  if (typeof v?.remember === 'boolean') out.remember = v.remember;
  if (SKIPS.includes(v?.skip)) out.skip = v.skip;
  return out;
};

function read() {
  try {
    return clean(JSON.parse(window.localStorage.getItem(KEY)));
  } catch {
    return { ...DEFAULTS };
  }
}

let prefs = read();
const listeners = new Set();

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getPlayerPrefs = () => prefs;

export function setPlayerPref(name, value) {
  prefs = clean({ ...prefs, [name]: value });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function resetPlayerPrefs() {
  prefs = { ...DEFAULTS };
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export const isDefault = (p) => Object.keys(DEFAULTS).every((k) => p[k] === DEFAULTS[k]);

/* The look of subtitle text for the current choices (a React style object).
   The base size follows the smaller of the screen's width and height, so a phone
   turned sideways does not get giant subtitles. */
export function subtitleStyle(p) {
  const size = SUB_SIZES.find((s) => s.id === p.subSize) || SUB_SIZES[1];
  const color = SUB_COLORS.find((c) => c.id === p.subColor) || SUB_COLORS[0];
  const style = {
    color: color.value,
    fontSize: `calc(var(--sub-base, clamp(14px, min(2.7vw, 4.6vh), 28px)) * ${size.scale})`,
  };
  if (p.subBack === 'box') {
    style.background = 'rgba(0, 0, 0, 0.74)';
    style.padding = '0.12em 0.55em';
    style.borderRadius = '0.35em';
  } else if (p.subBack === 'shadow') {
    style.textShadow = '0 1px 3px #000, 0 0 7px rgba(0, 0, 0, 0.95), 0 0 2px #000';
  } else {
    style.textShadow = '0 0 1px rgba(0, 0, 0, 0.5)';
  }
  return style;
}

export default function usePlayerPrefs() {
  return useSyncExternalStore(subscribe, getPlayerPrefs);
}
