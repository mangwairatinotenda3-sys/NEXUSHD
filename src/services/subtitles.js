import { Capacitor, CapacitorHttp } from '@capacitor/core';

/* Subtitles for Free Films. Archive.org films may come with .srt or .vtt
   files. Browsers only show WebVTT, so .srt files are converted here. */

const MAX_BYTES = 2 * 1024 * 1024;

const LANGS = {
  en: 'English', eng: 'English', english: 'English',
  es: 'Spanish', spa: 'Spanish', spanish: 'Spanish',
  fr: 'French', fre: 'French', fra: 'French', french: 'French',
  de: 'German', ger: 'German', deu: 'German', german: 'German',
  pt: 'Portuguese', por: 'Portuguese', portuguese: 'Portuguese',
  it: 'Italian', ita: 'Italian', italian: 'Italian',
  ru: 'Russian', rus: 'Russian', russian: 'Russian',
  nl: 'Dutch', dut: 'Dutch', dutch: 'Dutch',
  sv: 'Swedish', swe: 'Swedish', swedish: 'Swedish',
  ja: 'Japanese', jpn: 'Japanese', japanese: 'Japanese',
  zh: 'Chinese', chi: 'Chinese', chinese: 'Chinese',
  ar: 'Arabic', ara: 'Arabic', arabic: 'Arabic',
  hi: 'Hindi', hin: 'Hindi', hindi: 'Hindi',
  tr: 'Turkish', tur: 'Turkish', turkish: 'Turkish',
  pl: 'Polish', pol: 'Polish', polish: 'Polish',
  ko: 'Korean', kor: 'Korean', korean: 'Korean',
};

/* "Film.en.srt" -> "English". Only the end of the name is checked, so words
   inside a film title are not mistaken for a language. */
export function subtitleLanguage(fileName = '') {
  const base = fileName.split('/').pop().replace(/\.(srt|vtt)$/i, '');
  const tokens = base
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .slice(-2);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (LANGS[tokens[i]]) return LANGS[tokens[i]];
  }
  return '';
}

/* Picks the subtitle files of an Archive item: one per file name (WebVTT
   preferred over SRT), English first, at most six. */
export function pickSubtitles(files = [], toUrl) {
  const byBase = new Map();
  files.forEach((f) => {
    const m = /^(.*)\.(srt|vtt)$/i.exec(f.name || '');
    if (!m || Number(f.size) > MAX_BYTES) return;
    const current = byBase.get(m[1]);
    if (!current || (/\.vtt$/i.test(f.name) && !/\.vtt$/i.test(current.name))) {
      byBase.set(m[1], f);
    }
  });

  const used = new Map();
  const list = [...byBase.values()].map((f) => {
    const language = subtitleLanguage(f.name);
    const base = language || 'Subtitles';
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    return { label: n > 1 ? `${base} ${n}` : base, language, url: toUrl(f.name) };
  });

  list.sort((a, b) => (b.language === 'English') - (a.language === 'English'));
  return list.slice(0, 6);
}

function decode(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/* SRT -> WebVTT. WebVTT text passes through. */
export function toVtt(text) {
  const clean = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!clean.includes('-->')) throw new Error('Not a subtitle file');
  if (/^WEBVTT/.test(clean)) return clean;
  return `WEBVTT\n\n${clean.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}\n`;
}

/* In the Android app the file is fetched with the phone's own network layer,
   which is not blocked by the browser's cross-site rules. */
async function fetchBuffer(url, signal) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      url,
      method: 'GET',
      responseType: 'blob',
      connectTimeout: 15000,
      readTimeout: 15000,
    });
    if (res.status < 200 || res.status >= 300) throw new Error('Subtitles unavailable');
    const binary = atob(res.data || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Subtitles unavailable');
  return res.arrayBuffer();
}

export async function fetchSubtitleVtt(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const buffer = await fetchBuffer(url, controller.signal);
    if (buffer.byteLength > MAX_BYTES) throw new Error('Subtitles too large');
    return toVtt(decode(buffer));
  } finally {
    clearTimeout(timer);
  }
   }
