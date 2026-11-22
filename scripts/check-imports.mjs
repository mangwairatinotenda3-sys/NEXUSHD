/* Checks the project before a long build, so a missing file shows up as a
   short, clear list instead of a build error 10 minutes in.
   It looks at every file in src/ and checks that:
   - every file it imports (pages, components, services, styles) exists
   - every name it imports from your own files is really exported there
   - every package it imports is listed in package.json
   and that the logo files for the icon, the splash screen and the website are there.
   Run from the repository folder: node scripts/check-imports.mjs */
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'src';
const problems = [];
const add = (file, text) => problems.push({ file, text });

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packages = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]);

/* ---- files the Android build needs ---- */
for (const needed of [
  'scripts/android-native.mjs',
  'capacitor.config.json',
  'index.html',
  'public/get.html',
]) {
  if (!fs.existsSync(needed)) add(needed, 'this file is missing from the repository');
}

/* ---- the logo: app icon, splash screen and website icons ---- */
function pngSize(file) {
  const bytes = fs.readFileSync(file);
  const isPng = bytes.length > 24 && bytes.toString('latin1', 1, 4) === 'PNG';
  if (!isPng) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const LOGOS = [
  // file, what it is for, smallest good size
  ['assets/icon-only.png', 'the Android app icon', 1024],
  ['assets/icon-foreground.png', 'the round and adaptive Android icon', 1024],
  ['assets/splash.png', 'the Android splash screen', 2048],
  ['public/favicon-48.png', 'the browser tab icon', 48],
  ['public/icon-192.png', 'the website app icon', 192],
  ['public/icon-512.png', 'the website app icon (large)', 512],
  ['public/apple-touch-icon.png', 'the iPhone home screen icon', 180],
];
const notes = [];
for (const [file, use, min] of LOGOS) {
  if (!fs.existsSync(file)) {
    add(file, `logo file missing (${use})`);
    continue;
  }
  const size = pngSize(file);
  if (!size) {
    add(file, `this must be a real PNG picture (${use}), but it is not`);
    continue;
  }
  if (Math.min(size.width, size.height) < min) {
    notes.push(`${file} is ${size.width}x${size.height}; ${min}px or more looks sharper (${use})`);
  }
}

/* ---- read every source file ---- */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

if (!fs.existsSync(SRC)) {
  console.error('The src folder is missing.');
  process.exit(1);
}

const files = walk(SRC);
const codeOf = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const EXTENSIONS = ['', '.js', '.jsx', '.json', '.css'];
function resolve(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const ext of EXTENSIONS) {
    const file = base + ext;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  for (const ext of EXTENSIONS.slice(1)) {
    const file = path.join(base, 'index' + ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/* what a file exports */
const exportCache = new Map();
function exportsOf(file) {
  if (exportCache.has(file)) return exportCache.get(file);
  const code = codeOf(file);
  const names = new Set();
  let all = false;
  let hasDefault = /export\s+default\b/.test(code);
  for (const m of code.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*['"][^'"]+['"])?/g)) {
    m[1].split(',').forEach((part) => {
      const bits = part.trim().split(/\s+as\s+/);
      const out = (bits[1] || bits[0]).trim();
      if (out === 'default') hasDefault = true;
      else if (out) names.add(out);
    });
  }
  if (/export\s*\*\s*(?:as\s+\w+\s+)?from/.test(code)) all = true;
  const result = { names, all, hasDefault };
  exportCache.set(file, result);
  return result;
}

/* ---- check every import ---- */
const importRe = /import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g;
const exportFromRe = /export\s+(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s+['"]([^'"]+)['"]/g;
const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

for (const file of files) {
  const code = codeOf(file);
  const specs = [];

  for (const m of code.matchAll(importRe)) specs.push({ clause: m[1] || '', spec: m[2] });
  for (const m of code.matchAll(exportFromRe)) specs.push({ clause: '', spec: m[1] });
  for (const m of code.matchAll(dynamicRe)) specs.push({ clause: '', spec: m[1] });

  for (const { clause, spec } of specs) {
    if (spec.startsWith('.')) {
      const target = resolve(file, spec);
      if (!target) {
        add(file, `imports '${spec}' but that file does not exist`);
        continue;
      }
      if (!/\.(js|jsx)$/.test(target) || !clause) continue;

      const info = exportsOf(target);
      const defaultMatch = clause.match(/^\s*([A-Za-z0-9_$]+)\s*(?:,|$)/);
      if (defaultMatch && !info.hasDefault && !info.all) {
        add(file, `imports '${defaultMatch[1]}' as the main export of '${spec}', which has none`);
      }
      const braces = clause.match(/\{([\s\S]*)\}/);
      if (braces && !info.all) {
        braces[1].split(',').forEach((part) => {
          const name = part.trim().split(/\s+as\s+/)[0].trim();
          if (name && name !== 'default' && !info.names.has(name)) {
            add(file, `imports { ${name} } from '${spec}', but that file does not export it`);
          }
        });
      }
    } else {
      // a package: react, lucide-react, @capacitor/core, react-dom/client ...
      const parts = spec.split('/');
      const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
      if (!packages.has(name) && !spec.startsWith('node:') && !spec.startsWith('virtual:')) {
        add(file, `imports the package '${name}', which is not in package.json`);
      }
    }
  }
}

/* ---- the answer ---- */
notes.forEach((n) => console.warn(`Note: ${n}`));
if (problems.length === 0) {
  console.log(
    `All good: ${files.length} source files checked, every import is in place, and the logo files are there.`
  );
  process.exit(0);
}

console.error(`\nNot ready to build: ${problems.length} problem${problems.length === 1 ? '' : 's'} found.\n`);
const byFile = new Map();
problems.forEach((p) => byFile.set(p.file, [...(byFile.get(p.file) || []), p.text]));
for (const [file, texts] of byFile) {
  console.error(file);
  texts.forEach((t) => console.error(`   - ${t}`));
}
console.error(
  '\nUsually this means a file from one of the batches was not pasted yet, or was pasted with a different name. Logo files go in the assets and public folders.\n'
);
process.exit(1);
