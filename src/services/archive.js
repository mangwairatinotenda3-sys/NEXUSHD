/* Free Films: a hand-picked list of films hosted on the Internet Archive.
   Only add a film after opening its archive.org page and confirming it is
   public domain or openly licensed for the countries you serve. The id is
   the last part of the page address: archive.org/details/<id> */

export const FREE_FILMS = [
  {
    id: 'Nosferatu1922',
    title: 'Nosferatu',
    year: 1922,
    rights: 'Public domain (published in 1922)',
  },
  {
    id: 'TheGeneral1926',
    title: 'The General',
    year: 1926,
    rights: 'Public domain in the United States (published in 1926)',
  },
  {
    id: 'Night.Of.The.Living.Dead_1080p',
    title: 'Night of the Living Dead',
    year: 1968,
    rights: 'Public domain in the United States (released without a copyright notice)',
  },
];

const cache = new Map();

export const archiveThumb = (id) =>
  `https://archive.org/services/img/${encodeURIComponent(id)}`;

export const archivePage = (id) => `https://archive.org/details/${encodeURIComponent(id)}`;

export function fileUrl(id, name) {
  const path = name.split('/').map(encodeURIComponent).join('/');
  return `https://archive.org/download/${encodeURIComponent(id)}/${path}`;
}

export function stripHtml(html = '') {
  const text = new DOMParser().parseFromString(String(html), 'text/html').body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

export function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/* Picks a standard-quality MP4 (the smallest one over 20 MB) so playback
   starts quickly and uses less mobile data. */
export function pickVideo(files = []) {
  const mp4 = files
    .filter((f) => /\.mp4$/i.test(f.name) && Number(f.size) > 20 * 1024 * 1024)
    .sort((a, b) => Number(a.size) - Number(b.size));
  return mp4[0] || null;
}

const first = (v) => (Array.isArray(v) ? v[0] : v);

export async function loadFilm(entry) {
  if (cache.has(entry.id)) return cache.get(entry.id);

  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(entry.id)}`);
  if (!res.ok) throw new Error('Could not load film');
  const data = await res.json();
  if (!data.metadata || !data.files || data.is_dark) throw new Error('Film not available');

  const m = data.metadata;
  const file = pickVideo(data.files);
  const description = Array.isArray(m.description) ? m.description.join(' ') : m.description || '';

  const film = {
    ...entry,
    description: stripHtml(description).slice(0, 700),
    creator: first(m.creator) || '',
    licenseUrl: first(m.licenseurl) || '',
    seconds: file?.length ? Math.round(Number(file.length)) : 0,
    sizeBytes: file ? Number(file.size) : 0,
    src: file ? fileUrl(entry.id, file.name) : null,
  };
  cache.set(entry.id, film);
  return film;
}
