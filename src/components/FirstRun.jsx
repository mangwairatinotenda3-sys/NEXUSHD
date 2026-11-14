import { useEffect, useState } from 'react';
import Onboarding from './Onboarding.jsx';
import WhatsNew from './WhatsNew.jsx';
import InviteSheet from './InviteSheet.jsx';
import { APP_VERSION } from '../services/update.js';
import {
  hasOnboarded,
  lastSeenVersion,
  markOnboarded,
  markVersionSeen,
  onWelcomeEvent,
  releaseFor,
} from '../services/welcome.js';

/* Mounted once in the app shell. Shows, in this order:
   - the welcome screens, the first time the app is opened
   - "What's new", once after the app was updated to a version that has notes
   - the invite sheet, when asked for (Settings or the last welcome screen)
   Settings can also reopen any of them. */
export default function FirstRun() {
  const [view, setView] = useState(null); // 'welcome' | 'news' | 'invite'

  useEffect(() => {
    // never cover a password-reset link, a sign-in link or the legal pages
    const href = window.location.href;
    const special = /type=recovery|access_token|error_description|\/legal\//.test(href);

    if (!hasOnboarded()) {
      if (!special) setView('welcome');
      return undefined;
    }
    if (lastSeenVersion() !== APP_VERSION) {
      if (!releaseFor(APP_VERSION)) {
        markVersionSeen();
        return undefined;
      }
      if (special) return undefined;
      const t = setTimeout(() => setView((v) => v || 'news'), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  useEffect(() => onWelcomeEvent((what) => setView(what)), []);

  const finishWelcome = (next) => {
    markOnboarded();
    setView(next || null);
  };

  const closeNews = () => {
    markVersionSeen();
    setView(null);
  };

  if (view === 'welcome') {
    return (
      <Onboarding onDone={() => finishWelcome(null)} onInvite={() => finishWelcome('invite')} />
    );
  }
  if (view === 'news') {
    const release = releaseFor(APP_VERSION) || releaseFor('1.1.0');
    return release ? <WhatsNew release={release} onClose={closeNews} /> : null;
  }
  if (view === 'invite') return <InviteSheet onClose={() => setView(null)} />;
  return null;
  }
