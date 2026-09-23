/**
 * `npm run -s data:source -- <url> [--out=<file>] [--quote="<text>"] [--grep="<words>"]`
 *
 * The research helper for anyone adding a declaration (human or automated). It reads a source exactly
 * the way `data:check-quotes` will, so what you copy from its output is what the checker will find.
 * Pages that refuse scripted downloads are rendered in a headless Chromium when one is installed.
 *
 *   <url>              prints the extracted text of the page or PDF
 *   --out=<file>       writes it to a file instead
 *   --quote="<text>"   checks a quote against the source: exact / fuzzy / MISSING / NOFETCH (exit 1 unless exact or fuzzy)
 *   --grep="<words>"   prints only the passages around each occurrence of the words (case-insensitive)
 *   --links            lists the page's links (text -> absolute URL), to find sub-pages and PDFs
 */
import { writeFileSync } from 'node:fs';
import { checkQuote, extract, extractWithBrowser, fetchHtml } from './lib/sources.ts';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const opt = (name: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
};

if (!url || !/^https?:\/\//.test(url)) {
  console.error('Usage : npm run -s data:source -- <url> [--out=<fichier>] [--quote="<citation>"] [--grep="<mots>"]');
  process.exit(2);
}

if (args.includes('--links')) {
  const html = await fetchHtml(url);
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href: string;
    try {
      href = new URL(m[1], url).href;
    } catch {
      continue;
    }
    if (!/^https?:/.test(href) || seen.has(href)) continue;
    seen.add(href);
    const label = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    console.log(`${label || '(sans texte)'} -> ${href}`);
  }
  if (!seen.size) console.error('Aucun lien trouvé (page injoignable ?).');
  process.exit(seen.size ? 0 : 1);
}

const quote = opt('quote');
if (quote !== undefined) {
  const level = await checkQuote(url, quote);
  console.log(level);
  process.exit(level === 'exact' || level === 'fuzzy' ? 0 : 1);
}

let text = await extract(url);
if (!text.trim()) text = await extract(url, true);
if (!text.trim()) text = extractWithBrowser(url);
if (!text.trim()) {
  console.error('NOFETCH : source injoignable (site bloqué, lien mort, ou PDF protégé). Essayez une copie web.archive.org.');
  process.exit(1);
}
// Collapse the blank runs left by stripped markup, keeping line structure readable.
const tidy = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

const grep = opt('grep');
if (grep !== undefined) {
  const flat = tidy.replace(/\s+/g, ' ');
  const needle = grep.toLowerCase();
  const hits: string[] = [];
  for (let i = flat.toLowerCase().indexOf(needle); i !== -1; i = flat.toLowerCase().indexOf(needle, i + needle.length)) {
    hits.push(`… ${flat.slice(Math.max(0, i - 300), i + needle.length + 300)} …`);
  }
  console.log(hits.length ? hits.join('\n\n') : `Aucune occurrence de « ${grep} ».`);
} else if (opt('out')) {
  writeFileSync(opt('out') as string, tidy);
  console.log(`${tidy.length} caractères écrits dans ${opt('out')}`);
} else {
  console.log(tidy);
}
