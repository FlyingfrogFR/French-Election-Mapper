/**
 * `npm run -s data:search -- "<requête>" [--days=N]`
 *
 * Locating helper for the weekly research: dated news headlines (date, title, outlet) from the Google
 * News RSS feed, which needs no account and no search quota. A headline only says THAT something was
 * published — a speech, a signed op-ed, a programme launch — and its links are not usable (they go
 * through a JavaScript redirect), so none are printed. A position is never taken from a headline:
 * find the document itself on the candidate's official channels (or the signed op-ed on its
 * publisher's site) and read it with `npm run data:source`.
 *
 * Operators accepted in the query: "exact phrase", site:domain.fr, -word. --days limits to the last N days.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const query = args.filter((a) => !a.startsWith('--')).join(' ').trim();
const days = Number(args.find((a) => a.startsWith('--days='))?.slice('--days='.length) ?? '0');
if (!query) {
  console.error('Usage : npm run -s data:search -- "<requête>" [--days=N]');
  process.exit(2);
}

const q = `${query}${days > 0 ? ` when:${days}d` : ''}`;
const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
let xml = '';
try {
  xml = execFileSync('curl', ['-sS', '-f', '-m', '30', '-A', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0 Safari/537.36', url], {
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString('utf8');
} catch {
  console.error('Recherche indisponible (réseau ou service).');
  process.exit(1);
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
  const tag = (name: string) => decode(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(m[1])?.[1] ?? '');
  const date = new Date(tag('pubDate'));
  return {
    date: Number.isNaN(date.getTime()) ? '????-??-??' : date.toISOString().slice(0, 10),
    title: tag('title'),
    source: tag('source'),
  };
});
items.sort((a, b) => b.date.localeCompare(a.date));
const lines = items.slice(0, 30).map((it) => `${it.date} · ${it.title}${it.source && !it.title.endsWith(it.source) ? ` (${it.source})` : ''}`);
process.stdout.write(`${lines.length ? lines.join('\n') : `Aucun résultat pour « ${q} ».`}\n`);
