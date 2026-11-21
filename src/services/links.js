import { shareLink } from './share.js';

/* Links to a title. They open the web version of NexusHD in any browser. On
   Android, the web page offers "Open in the app", and the app also opens
   nexushd:// links by itself. */

export const WEB_BASE = 'https://mangwairatinotenda3-sys.github.io/NEXUSHD/';
export const APP_ID = 'com.nexushd.app';

const kindOf = (m) => (m?.media_type === 'tv' ? 'tv' : 'movie');

export const titleRoute = (kind, id) => `/${kind === 'tv' ? 'tv' : 'movie'}/${id}`;
export const filmRoute = (id) => `/free?play=${encodeURIComponent(id)}`;
export const webUrl = (route) => `${WEB_BASE}#${route}`;

/* The only places a link may open, so a strange link can never go anywhere else */
const ALLOWED = [/^\/(movie|tv)\/\d{1,9}$/, /^\/free(\?play=[A-Za-z0-9._%-]{1,200})?$/, /^\/soon$/];

export const isAllowedRoute = (route) => ALLOWED.some((re) => re.test(route));

/* nexushd://movie/123, nexushd://free?play=abc or a web link with #/movie/123 → '/movie/123', or null */
export function routeFromLink(link) {
  try {
    const url = new URL(String(link));
    let route = '';
    if (url.protocol === 'nexushd:') {
      route = `/${url.hostname}${url.pathname === '/' ? '' : url.pathname}${url.search}`;
    } else {
      route = url.hash.replace(/^#/, '');
    }
    return isAllowedRoute(route) ? route : null;
  } catch {
    return null;
  }
}

/* nexushd://movie/123 for a route like /movie/123 */
export const appLink = (route) => `nexushd:/${route}`;

/* A link that opens the app on Android if it is installed, and the download
   page if it is not. Meant for Chrome on Android. */
export function intentLink(route) {
  const rest = appLink(route).replace('nexushd://', '');
  const fallback = encodeURIComponent(`${WEB_BASE}get.html`);
  return `intent://${rest}#Intent;scheme=nexushd;package=${APP_ID};S.browser_fallback_url=${fallback};end`;
}

/* Opens the share sheet for a movie or series. Returns 'shared', 'copied', 'cancelled' or 'failed'. */
export function shareTitle(movie, kind) {
  const type = kind || kindOf(movie);
  const year = movie.release_date ? String(movie.release_date).slice(0, 4) : '';
  const what = type === 'tv' ? 'series' : 'movie';
  const rating = movie.vote_average > 0 ? ` · ★ ${movie.vote_average.toFixed(1)}` : '';
  return shareLink({
    title: movie.title,
    text: `Have a look at the ${what} “${movie.title}”${year ? ` (${year})` : ''}${rating} on NexusHD:`,
    url: webUrl(titleRoute(type, movie.id)),
  });
}

/* Opens a free film from the Internet Archive collection */
export function shareFilm(film) {
  return shareLink({
    title: film.title,
    text: `Watch “${film.title}”, a free film, on NexusHD:`,
    url: webUrl(filmRoute(film.id)),
  });
}
