/**
 * `npm run data:check-quotes [-- --candidate=<id>] [--limit=N] [--offline]`
 *
 * Verifies the promise "no distortion" mechanically: for every position that carries a `quote`,
 * fetches the cited source (HTML page or PDF) and checks that the quote really appears in it.
 *
 * Levels reported per position:
 *   exact   the quote appears verbatim (after normalising whitespace, apostrophes, dashes, ligatures)
 *   fuzzy   at least 60 % of the quote's 4-word sequences appear — typical of PDF line breaks
 *   MISSING the quote was not found in the source: the position must be corrected or removed
 *   NOFETCH the source could not be fetched (site down, archive unavailable): nothing is proven
 *
 * Sources are cached under .cache/quotes/ so a second run is fast and kind to the servers.
 * `--offline` uses only what is already cached. Exit code 1 if any position is MISSING.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { loadRawData, ROOT } from './lib/load.ts';

// Override with QUOTES_CACHE to reuse texts extracted elsewhere (some publishers block automated downloads).
const CACHE = process.env.QUOTES_CACHE || join(ROOT, '.cache', 'quotes');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Minimal shape of pdf-parse 2's PDFParse class, so the script stays typed without pulling its types in. */
interface PdfParser {
  getText(): Promise<{ text: string }>;
  destroy?(): Promise<void>;
}

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--candidate='))?.split('=')[1];
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0');
const offline = args.includes('--offline');

/** Wayback pages need the `id_` modifier to return the raw document instead of the archive's HTML wrapper. */
function waybackRaw(url: string): string {
  const m = /^(https:\/\/web\.archive\.org\/web\/)(\d{4,14})(\/)(https?:\/\/.*)$/.exec(url);
  return m && !m[2].endsWith('id_') ? `${m[1]}${m[2]}id_${m[3]}${m[4]}` : url;
}

/** PDFs break words across lines ("incon-\ntournables"); glue them back before matching. */
function dehyphenate(text: string): string {
  return text.replace(/-\s+/g, '');
}

function normalise(text: string): string {
  let t = text.normalize('NFKC');
  for (const [a, b] of [
    ['’', "'"], ['‘', "'"], [' ', ' '], [' ', ' '],
    ['«', '"'], ['»', '"'], ['“', '"'], ['”', '"'], ['œ', 'oe'], ['Œ', 'OE'],
  ]) t = t.split(a).join(b);
  return (
    t
      .replace(/[‐-―−]/g, '-')
      .replace(/\s+/g, ' ')
      // Stripping inline tags leaves spaces around apostrophes ("c 'est", "d' arrière-garde"); French has none.
      .replace(/\s*'\s*/g, "'")
      .trim()
      .toLowerCase()
  );
}

/** Named HTML entities that appear in French pages; without them accented words never match. */
const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', laquo: '"', raquo: '"',
  hellip: '…', mdash: '—', ndash: '–', deg: '°', euro: '€', times: '×', middot: '·',
  agrave: 'à', acirc: 'â', aelig: 'æ', ccedil: 'ç',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', oelig: 'œ', ouml: 'ö',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü', ntilde: 'ñ', yuml: 'ÿ',
};

function stripHtml(raw: string): string {
  const withoutScripts = raw.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  return withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name: string) => {
      const lower = ENTITIES[name.toLowerCase()];
      if (!lower) return m;
      // &Eacute; is the capital of &eacute;
      return name[0] === name[0].toUpperCase() && name !== name.toUpperCase() ? lower.toUpperCase() : lower;
    });
}

async function extract(url: string, viaCurl = false): Promise<string> {
  const isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');
  const target = isPdf ? waybackRaw(url) : url;
  const key = createHash('sha1').update(`${viaCurl ? 'curl:' : ''}${target}`).digest('hex');
  const cached = join(CACHE, `${key}.txt`);
  if (existsSync(cached)) return readFileSync(cached, 'utf8');
  if (offline) return '';
  mkdirSync(CACHE, { recursive: true });
  const download = async (): Promise<Buffer | null> => {
    if (!viaCurl) {
      try {
        const res = await fetch(target, { headers: { 'user-agent': UA, 'accept-language': 'fr' }, redirect: 'follow' });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      } catch {
        /* fall through to curl */
      }
    }
    // Some publishers reject plain fetch but accept a full browser header set.
    try {
      return execFileSync(
        'curl',
        ['-sS', '-m', '60', '-L', '-A', UA, '-H', 'accept: text/html,application/pdf,*/*', '-H', 'accept-language: fr-FR,fr;q=0.9', target],
        { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
      );
    } catch {
      return null;
    }
  };
  try {
    const buf = await download();
    if (!buf || buf.length === 0) return '';
    if (buf.subarray(0, 15).toString('latin1').includes('<!DOC') && isPdf) return ''; // bot-protection page served instead of the PDF
    let text: string;
    if (buf.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
      const require = createRequire(import.meta.url);
      // pdf-parse 2 exposes a PDFParse class instead of a callable module.
      const { PDFParse } = require('pdf-parse') as { PDFParse: new (opts: { data: Uint8Array }) => PdfParser };
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      // pdf.js logs font warnings on stdout for many real-world PDFs; they are irrelevant here.
      const warn = console.warn;
      console.warn = () => {};
      try {
        text = (await parser.getText()).text;
      } finally {
        console.warn = warn;
        await parser.destroy?.();
      }
    } else {
      text = stripHtml(buf.toString('utf8'));
    }
    writeFileSync(cached, text);
    return text;
  } catch {
    return '';
  }
}

/** Share of the quote's 4-word sequences present in the source: tolerant to line breaks and hyphenation. */
function coverage(quote: string, source: string): number {
  const words = quote.split(' ');
  if (words.length < 4) return source.includes(quote) ? 1 : 0;
  const grams = Array.from({ length: words.length - 3 }, (_, i) => words.slice(i, i + 4).join(' '));
  return grams.filter((g) => source.includes(g)).length / grams.length;
}

function grade(quote: string, source: string): 'exact' | 'fuzzy' | 'MISSING' {
  const q = dehyphenate(quote);
  const s = dehyphenate(source);
  if (source.includes(quote) || s.includes(q)) return 'exact';
  return Math.max(coverage(quote, source), coverage(q, s)) >= 0.6 ? 'fuzzy' : 'MISSING';
}

const raw = loadRawData();
const cache = new Map<string, string>();
const counts = { exact: 0, fuzzy: 0, MISSING: 0, NOFETCH: 0, skipped: 0 };
const problems: string[] = [];
let checked = 0;

for (const file of raw.declarationFiles) {
  if (only && file.candidateId !== only) continue;
  for (const decl of file.declarations) {
    for (const pos of decl.positions) {
      if (!pos.quote) {
        counts.skipped++;
        continue;
      }
      if (limit && checked >= limit) break;
      checked++;
      const url = pos.sourceUrl ?? decl.sourceUrl;
      if (!cache.has(url)) cache.set(url, normalise(await extract(url)));
      let source = cache.get(url) as string;
      const quote = normalise(pos.quote);
      let level: keyof typeof counts = source ? grade(quote, source) : 'NOFETCH';
      // A plain fetch sometimes returns a partial page; a full browser header set usually gets the rest.
      if (level !== 'exact' && level !== 'fuzzy') {
        const retryKey = `curl:${url}`;
        if (!cache.has(retryKey)) cache.set(retryKey, normalise(await extract(url, true)));
        const retry = cache.get(retryKey) as string;
        if (retry) {
          source = `${source} ${retry}`;
          cache.set(url, source);
          level = grade(quote, source);
        }
      }
      counts[level]++;
      if (level === 'MISSING' || level === 'NOFETCH') {
        problems.push(`  ${level.padEnd(7)} ${file.candidateId}/${pos.questionId}  ${url}\n            « ${pos.quote.slice(0, 120)} »`);
      }
    }
  }
}

console.log(
  `Citations contrôlées : ${checked} — ${counts.exact} exactes, ${counts.fuzzy} approchantes (coupures de PDF), ${counts.MISSING} introuvables, ${counts.NOFETCH} sources injoignables. ${counts.skipped} position(s) sans citation (encodage antérieur à l'audit).`,
);
if (counts.NOFETCH > 0) {
  console.log(
    "\nUne source « injoignable » ne signifie pas que la citation est fausse : certains éditeurs (protection anti-robots) refusent les téléchargements automatisés. Récupérez alors la page dans un navigateur et placez son texte dans le cache (QUOTES_CACHE, nom de fichier = SHA-1 de l'URL + .txt).",
  );
}
if (problems.length) console.log(`\nÀ examiner :\n${problems.join('\n')}`);
if (counts.MISSING > 0) {
  console.error(`\n✘ ${counts.MISSING} citation(s) introuvable(s) dans la source citée : corriger la citation ou retirer la position.`);
  process.exit(1);
}
