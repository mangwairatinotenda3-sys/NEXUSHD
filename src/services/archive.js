/* Free Films: films hosted on the Internet Archive.
   - FREE_FILMS is a hand-picked list. Only add a film after opening its
     archive.org page and confirming it is public domain or openly licensed.
     The id is the last part of the address: archive.org/details/<id>
   - searchFreeFilms() browses more titles, but only ones the uploader has
     tagged with a Public Domain or CC0 licence. */

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
    id: 'HisGirlFriday-1940',
    title: 'His Girl Friday',
    year: 1940,
    rights: 'Public domain in the United States (copyright not renewed)',
  },
  {
    id: 'plan-9-from-outer-space',
    title: 'Plan 9 from Outer Space',
    year: 1959,
    rights: 'Marked CC0 (public domain dedication) on the Internet Archive',
  },
  {
    id: 'CarnivalOfSoulsVideoQualityUpgrade',
    title: 'Carnival of Souls',
    year: 1962,
    rights: 'Public domain in the United States only (released without a copyright notice)',
  },
  {
    id: 'Charade19631280x696',
    title: 'Charade',
    year: 1963,
    rights:
      'Public domain in the United States (defective copyright notice); the music score may still be protected',
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

/* Lists the playable video files of an item, best first.
   - skips trailers, samples and previews
   - keeps only the longest version (the full film)
   - prefers the browser-friendly files the Archive makes itself
     (derivatives) over the uploader's original file
   - then the smallest file, so playback starts quickly on mobile data
   The player tries the next file if one fails. */
const SKIP = /trailer|sample|preview|promo|teaser|_thumb|\.thumbs/i;

export function pickVideos(files = []) {
  const playable = files.filter(
    (f) =>
      /\.(mp4|m4v|webm|ogv)$/i.test(f.name) &&
      !SKIP.test(f.name) &&
      Number(f.size) > 2 * 1024 * 1024
  );
  const longest = Math.max(0, ...playable.map((f) => Number(f.length) || 0));
  const full = longest
    ? playable.filter((f) => (Number(f.length) || 0) >= longest * 0.9)
    : playable;
  const rank = (f) => {
    const type = /\.(mp4|m4v)$/i.test(f.name) ? 0 : 1;
    const derived = f.source === 'derivative' ? 0 : 1;
    return [type, derived, Number(f.size)];
  };
  return full.sort((x, y) => {
    const a = rank(x);
    const b = rank(y);
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  });
}

/* Other files to try if the first one does not play: src -> [urls] */
const alternates = new Map();
export const alternatesFor = (src) => alternates.get(src) || [];

const firstValue = (v) => (Array.isArray(v) ? v[0] : v);

export async function loadFilm(entry) {
  if (cache.has(entry.id)) return cache.get(entry.id);

  const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(entry.id)}`);
  if (!res.ok) throw new Error('Could not load film');
  const data = await res.json();
  if (!data.metadata || !data.files || data.is_dark) throw new Error('Film not available');

  const m = data.metadata;
  const videos = pickVideos(data.files);
  const file = videos[0] || null;
  const description = Array.isArray(m.description) ? m.description.join(' ') : m.description || '';

  const film = {
    ...entry,
    description: stripHtml(description).slice(0, 700),
    creator: firstValue(m.creator) || entry.creator || '',
    licenseUrl: firstValue(m.licenseurl) || '',
    seconds: file?.length ? Math.round(Number(file.length)) : 0,
    sizeBytes: file ? Number(file.size) : 0,
    src: file ? fileUrl(entry.id, file.name) : null,
  };
  if (film.src) {
    alternates.set(
      film.src,
      videos.slice(1, 5).map((v) => fileUrl(entry.id, v.name))
    );
  }
  cache.set(entry.id, film);
  return film;
}

const SORTS = {
  popular: 'downloads desc',
  newest: 'date desc',
  title: 'titleSorter asc',
};

const hasPublicDomainTag = (value) =>
  (Array.isArray(value) ? value : [value]).some(
    (v) => typeof v === 'string' && v.toLowerCase().includes('publicdomain')
  );

/* Finds more films. Only items tagged Public Domain or CC0 are returned. */
export async function searchFreeFilms({ term = '', sort = 'popular', page = 1, rows = 24 } = {}) {
  const words = term
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  const parts = [
    'mediatype:movies',
    'collection:feature_films',
    'licenseurl:(*publicdomain*)',
  ];
  if (words.length) parts.push(`title:(${words.map((w) => `${w}*`).join(' AND ')})`);
  parts.push('NOT subject:(adult OR erotic OR xxx)');

  const params = new URLSearchParams();
  params.set('q', parts.join(' AND '));
  ['identifier', 'title', 'year', 'date', 'creator', 'licenseurl'].forEach((f) =>
    params.append('fl[]', f)
  );
  params.append('sort[]', SORTS[sort] || SORTS.popular);
  params.set('rows', String(rows));
  params.set('page', String(page));
  params.set('output', 'json');

  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  const docs = data.response?.docs || [];
  const total = data.response?.numFound || 0;

  const films = docs
    .filter((d) => hasPublicDomainTag(d.licenseurl))
    .map((d) => {
      const date = firstValue(d.date) || firstValue(d.year) || '';
      return {
        id: d.identifier,
        title: String(firstValue(d.title) || d.identifier),
        year: parseInt(date, 10) || null,
        creator: firstValue(d.creator) || '',
        rights: 'Tagged as public domain or CC0 by the uploader on the Internet Archive',
        discovered: true,
      };
    });

  return { films, hasMore: page * rows < total };
     }
