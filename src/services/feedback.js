import { Capacitor } from '@capacitor/core';
import { APP_VERSION, BUILD } from './update.js';

/* Feedback goes to the maker by email. The app opens the phone's mail app
   with the message already written; nothing is sent from a server. */

export const FEEDBACK_EMAIL = 'mangwairatinotenda3@gmail.com';

export const KINDS = [
  { id: 'bug', label: 'Something broke', subject: 'Bug report' },
  { id: 'idea', label: 'Idea', subject: 'Idea' },
  { id: 'other', label: 'Other', subject: 'Feedback' },
];

/* A few plain facts that help to fix a bug. No personal information. */
export function deviceInfo() {
  const ua = navigator.userAgent || '';
  const android = /Android\s([\d.]+)/.exec(ua);
  const model = /Android\s[\d.]+;\s*([^)]+)\)/.exec(ua);
  const lines = [
    `App: NexusHD v${APP_VERSION}${BUILD ? ` (build ${BUILD})` : ''}`,
    `Where: ${Capacitor.isNativePlatform() ? 'Android app' : 'Website'}`,
  ];
  if (android) lines.push(`Android: ${android[1]}`);
  if (model) lines.push(`Phone: ${model[1].trim()}`);
  lines.push(`Screen: ${window.screen?.width || '?'}x${window.screen?.height || '?'}`);
  lines.push(`Theme: ${document.documentElement.getAttribute('data-theme') || 'dark'}`);
  return lines.join('\n');
}

export function buildMessage({ kind, message, includeInfo }) {
  const k = KINDS.find((x) => x.id === kind) || KINDS[2];
  const subject = `NexusHD: ${k.subject}`;
  let body = message.trim();
  if (includeInfo) body += `\n\n--\nAbout my phone:\n${deviceInfo()}`;
  return { subject, body };
}

export function buildMailto(args) {
  const { subject, body } = buildMessage(args);
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
