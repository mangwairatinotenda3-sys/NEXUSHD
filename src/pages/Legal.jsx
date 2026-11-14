import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import '../styles/legal.css';

const UPDATED = '14 November 2026';
const ISSUES = 'https://github.com/mangwairatinotenda3-sys/NEXUSHD/issues';

const External = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

function Privacy() {
  return (
    <>
      <p className="legal-short">
        <b>In short:</b> NexusHD has no ads, no tracking and no analytics, and we never sell your
        information. We only keep what the app needs to work, and you can delete your account at
        any time.
      </p>

      <h2>1. What the app keeps</h2>
      <p>
        <b>If you create an account:</b> your email address, a username and your password. Your
        password is stored in a scrambled form by our account provider, so nobody at NexusHD can
        read it. You can also add a profile picture.
      </p>
      <p>
        <b>Your list:</b> the titles you save are stored with your account so they follow you to
        other devices. If you do not sign in, your list stays on your phone only.
      </p>
      <p>
        <b>Only on your phone:</b> your theme and notification choice, recent searches, recently
        viewed titles, where you stopped watching, and the films you download. This never leaves
        your device.
      </p>
      <p>
        We do not collect your contacts, your location or your phone's advertising ID, and the app
        contains no advertising or analytics code.
      </p>

      <h2>2. Other services the app talks to</h2>
      <p>To work, the app connects to a few services. Each one follows its own privacy policy.</p>
      <ul>
        <li>
          <b>Supabase</b> keeps accounts, saved lists and profile pictures. It also passes our
          requests to TMDB, so TMDB does not see your device.
        </li>
        <li>
          <b>TMDB</b> provides movie and series information. This product uses the TMDB API but is
          not endorsed or certified by TMDB.
        </li>
        <li>
          <b>YouTube</b> plays trailers. YouTube may collect data when a trailer plays.
        </li>
        <li>
          <b>Internet Archive</b> provides the Free Films, their posters and subtitles. It can see
          your internet address and which film you open.
        </li>
        <li>
          <b>GitHub</b> hosts the website and the app downloads, and answers the "check for
          updates" request. It can see your internet address.
        </li>
        <li>
          <b>Google Fonts</b> supplies the app's text font.
        </li>
      </ul>

      <h2>3. Notifications</h2>
      <p>
        Alerts, for example when a download finishes, are created by the app on your phone. There
        is no push-notification server. You can turn them off in Settings.
      </p>

      <h2>4. Keeping and deleting your information</h2>
      <p>
        Your account information stays until you delete your account. You can delete it yourself
        from the Profile screen, which removes your account and your saved list. Information on
        your phone is removed when you clear the app's data or uninstall it. In Settings you can
        also clear your search history and recently viewed titles.
      </p>

      <h2>5. Children</h2>
      <p>
        NexusHD is not meant for children under 13, and we do not knowingly collect their
        information. If you think a child has made an account, contact us and we will remove it.
      </p>

      <h2>6. Security</h2>
      <p>
        Connections are encrypted (HTTPS). No service is perfectly secure, so please use a strong
        password that you do not use anywhere else.
      </p>

      <h2>7. Changes</h2>
      <p>
        If this policy changes, the date at the top changes and we will mention important changes
        in the release notes.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions or requests about your information: <External href={ISSUES}>open an issue</External>{' '}
        on our project page.
      </p>
    </>
  );
}

function Terms() {
  return (
    <>
      <p className="legal-short">
        <b>In short:</b> NexusHD helps you find what to watch and plays free, public domain films.
        Use it lawfully, and check that a film is free to watch where you live.
      </p>

      <h2>1. What NexusHD is</h2>
      <p>
        NexusHD is a discovery app for movies and series. Titles, pictures, ratings and trailers
        come from other services such as TMDB and YouTube. NexusHD does not host videos itself and
        does not offer paid or pirated films.
      </p>

      <h2>2. Using the app</h2>
      <ul>
        <li>You must be at least 13 years old.</li>
        <li>Use the app lawfully and do not try to disrupt it, attack it or misuse other people's accounts.</li>
        <li>Keep your password private. You are responsible for what happens under your account.</li>
      </ul>

      <h2>3. Free Films and copyright</h2>
      <p>
        Free Films are hosted by the Internet Archive and tagged by their uploaders as public domain
        or openly licensed. Copyright rules are different in every country, so a film that is free in
        one country may not be free in another. It is your responsibility to make sure a film is free
        to watch where you live.
      </p>
      <p>
        Downloads are for your own offline viewing. Do not copy, sell or share the films in a way the
        film's licence does not allow.
      </p>

      <h2>4. Other people's content</h2>
      <p>
        Trailers, posters, descriptions and names belong to their owners. Watching a trailer does not
        give you any right to the full film.
      </p>

      <h2>5. Your account</h2>
      <p>
        You can delete your account at any time from the Profile screen. We may suspend an account
        that is used to abuse the app or other people.
      </p>

      <h2>6. No promises, and limits</h2>
      <p>
        NexusHD is provided "as is". It may change, have bugs or stop working, and the services it
        depends on may be unavailable. To the extent the law allows, NexusHD and its maker are not
        responsible for losses that come from using the app. Rights you have by law that cannot be
        removed still apply.
      </p>

      <h2>7. Rights holders</h2>
      <p>
        If you own the rights to a film and believe it should not be listed in the app, please{' '}
        <External href={ISSUES}>tell us</External> with a link to the film, and we will remove it
        from the app promptly.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these terms. The date at the top shows the latest version, and using the app
        after a change means you accept it.
      </p>

      <h2>9. Contact</h2>
      <p>
        <External href={ISSUES}>Open an issue</External> on our project page.
      </p>
    </>
  );
}

const DOCS = {
  privacy: { label: 'Privacy', title: 'Privacy Policy', Body: Privacy },
  terms: { label: 'Terms', title: 'Terms of Use', Body: Terms },
};

export default function Legal() {
  const { doc } = useParams();
  const navigate = useNavigate();
  const page = DOCS[doc];

  // a reading page: no bottom tab bar
  useEffect(() => {
    document.body.classList.add('hide-nav');
    return () => document.body.classList.remove('hide-nav');
  }, []);

  if (!page) return <Navigate to="/settings" replace />;
  const { title, Body } = page;

  return (
    <div className="page">
      <Header title={title} back />

      <div className="legal-tabs">
        <div className="segmented" role="tablist" aria-label="Legal documents">
          {Object.entries(DOCS).map(([id, d]) => (
            <button
              key={id}
              role="tab"
              aria-selected={doc === id}
              className={doc === id ? 'on' : ''}
              onClick={() => navigate(`/legal/${id}`, { replace: true })}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <article className="legal">
        <div className="legal-date">Last updated {UPDATED}</div>
        <Body />
      </article>
    </div>
  );
}
