import { useMemo, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Search, Tv2 } from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage.js';
import { tmdb, imageUrl, useMovies } from '../services/tmdb.js';
import '../styles/watch.css';

/* Where a title can be watched, in your country. The data comes from TMDB
   (which gets it from JustWatch). NexusHD does not stream these titles; a tap
   opens the page that lists the services. */

const GROUPS = [
  { key: 'flatrate', label: 'Stream' },
  { key: 'free', label: 'Free' },
  { key: 'ads', label: 'Free with ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

// phone time zone -> country, for the countries most of our users are in
const ZONES = {
  'Africa/Harare': 'ZW',
  'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
  'Africa/Accra': 'GH',
  'Africa/Lusaka': 'ZM',
  'Africa/Gaborone': 'BW',
  'Africa/Maputo': 'MZ',
  'Africa/Kampala': 'UG',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Cairo': 'EG',
  'Africa/Windhoek': 'NA',
  'Africa/Blantyre': 'MW',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Casablanca': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Europe/London': 'GB',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'Australia/Sydney': 'AU',
  'Asia/Kolkata': 'IN',
};

function guessRegion() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (ZONES[zone]) return ZONES[zone];
  } catch {
    /* no time zone info */
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const l of langs) {
    const m = /-([A-Za-z]{2})$/.exec(l);
    if (m) return m[1].toUpperCase();
  }
  return 'US';
}

let names = null;
function countryName(code) {
  try {
    if (!names) names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(code) || code;
  } catch {
    return code;
  }
}

const flag = (code) =>
  /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
    : '';

const byPriority = (a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99);

function CountrySheet({ codes, current, onPick, onClose }) {
  const [term, setTerm] = useState('');
  const list = useMemo(
    () =>
      codes
        .map((code) => ({ code, name: countryName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((c) => c.name.toLowerCase().includes(term.trim().toLowerCase())),
    [codes, term]
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet ww-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Choose your country</h3>
        <p>Streaming services are different in every country.</p>

        {codes.length > 10 && (
          <div className="ww-search">
            <Search size={18} />
            <input
              aria-label="Search countries"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        <div className="ww-countries">
          {list.map((c) => (
            <button
              key={c.code}
              type="button"
              className={c.code === current ? 'on' : ''}
              onClick={() => onPick(c.code)}
            >
              <span className="ww-flag">{flag(c.code)}</span>
              <span className="ww-cname">{c.name}</span>
              {c.code === current && <Check size={18} />}
            </button>
          ))}
          {list.length === 0 && <div className="ww-none">No country matches "{term}".</div>}
        </div>
      </div>
    </div>
  );
}

function Provider({ p, link }) {
  const logo = imageUrl(p.logo_path, 'w92');
  return (
    <button
      type="button"
      className="ww-prov"
      onClick={() => link && window.open(link, '_blank', 'noopener')}
      aria-label={`${p.provider_name}, opens the watch page`}
    >
      <span className="ww-logo">
        {logo ? (
          <img src={logo} alt="" loading="lazy" draggable="false" />
        ) : (
          <b>{p.provider_name.charAt(0)}</b>
        )}
      </span>
      <span className="ww-pname">{p.provider_name}</span>
    </button>
  );
}

export default function WhereToWatch({ kind, id }) {
  const [saved, setSaved] = useLocalStorage('nexushd:region', '');
  const [picking, setPicking] = useState(false);
  const { data, loading, error } = useMovies(() => tmdb.watchProviders(kind, id), [kind, id]);

  if (loading) {
    return (
      <section className="d-section ww" aria-busy="true">
        <div className="ww-head">
          <div className="skeleton" style={{ height: 20, width: 130 }} />
          <div className="skeleton" style={{ height: 32, width: 110, borderRadius: 999 }} />
        </div>
        <div className="ww-row">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ww-prov">
              <div className="skeleton ww-logo" />
              <div className="skeleton" style={{ height: 10, width: 44, marginTop: 8 }} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // this is an extra, so when it cannot load the page simply goes without it
  if (error || !data) return null;

  const results = data.results || {};
  const usable = Object.keys(results).filter((code) =>
    GROUPS.some((g) => results[code]?.[g.key]?.length)
  );
  if (usable.length === 0) return null;

  const region = saved || guessRegion();
  const info = results[region];
  const here = GROUPS.map((g) => ({ ...g, items: [...(info?.[g.key] || [])].sort(byPriority) })).filter(
    (g) => g.items.length
  );

  return (
    <section className="d-section ww">
      <div className="ww-head">
        <h2>Where to watch</h2>
        <button type="button" className="ww-country" onClick={() => setPicking(true)}>
          <span className="ww-flag">{flag(region)}</span>
          {countryName(region)}
          <ChevronDown size={16} />
        </button>
      </div>

      {here.length > 0 ? (
        here.map((g) => (
          <div key={g.key} className="ww-group">
            <div className="ww-label">{g.label}</div>
            <div className="ww-row">
              {g.items.map((p) => (
                <Provider key={p.provider_id} p={p} link={info?.link} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="ww-empty">
          <Tv2 size={22} />
          <span>
            Not on any streaming service in {countryName(region)} right now. Try another country.
          </span>
        </div>
      )}

      <div className="ww-credit">
        {info?.link && here.length > 0 ? (
          <button type="button" onClick={() => window.open(info.link, '_blank', 'noopener')}>
            See all options <ExternalLink size={13} />
          </button>
        ) : (
          <span />
        )}
        <span>Streaming data by JustWatch</span>
      </div>

      {picking && (
        <CountrySheet
          codes={usable}
          current={region}
          onPick={(code) => {
            setSaved(code);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}
