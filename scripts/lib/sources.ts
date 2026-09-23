/**
 * Fetching and reading official sources, shared by the citation checker (`data:check-quotes`) and the
 * research helper (`data:source`).
 *
 * Both go through the same download, extraction and normalisation, so a quote copied from the text
 * `data:source` prints is guaranteed to be judged against that very text when CI re-checks it.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { ROOT } from './load.ts';

// Override with QUOTES_CACHE to reuse texts extracted elsewhere (some publishers block automated downloads).
const CACHE = process.env.QUOTES_CACHE || join(ROOT, '.cache', 'quotes');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Minimal shape of pdf-parse 2's PDFParse class, so the script stays typed without pulling its types in. */
interface PdfParser {
  getText(): Promise<{ text: string }>;
  destroy?(): Promise<void>;
}

export type QuoteLevel = 'exact' | 'fuzzy' | 'MISSING' | 'NOFETCH';

let offline = false;
/** Only read what is already cached; never download. */
export function setOffline(value: boolean): void {
  offline = value;
}

/** Wayback pages need the `id_` modifier to return the raw document instead of the archive's HTML wrapper. */
function waybackRaw(url: string): string {
  const m = /^(https:\/\/web\.archive\.org\/web\/)(\d{4,14})(\/)(https?:\/\/.*)$/.exec(url);
  return m && !m[2].endsWith('id_') ? `${m[1]}${m[2]}id_${m[3]}${m[4]}` : url;
}

/** PDFs break words across lines ("incon-\ntournables"); glue them back before matching. */
function dehyphenate(text: string): string {
  return text.replace(/-\s+/g, '');
}

export function normalise(text: string): string {
  let t = text.normalize('NFKC');
  for (const [a, b] of [
    ['’', "'"], ['‘', "'"], [' ', ' '], [' ', ' '],
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

/** A bot-protection page is not the source: better no text than the wrong text. */
function isChallenge(text: string): boolean {
  return /just a moment|checking your browser|attention required|enable javascript and cookies/i.test(text.slice(0, 2000));
}

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

/** Downloads a source (HTML page or PDF) and returns its text, cached under .cache/quotes/. Empty string if unreachable. */
export async function extract(url: string, viaCurl = false): Promise<string> {
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
        ['-sS', '-f', '-m', '60', '-L', '-A', UA, '-H', 'accept: text/html,application/pdf,*/*', '-H', 'accept-language: fr-FR,fr;q=0.9', target],
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
      if (isChallenge(text)) return '';
    }
    writeFileSync(cached, text);
    return text;
  } catch {
    return '';
  }
}

/** A headless Chromium, when one is installed: CHROMIUM overrides the lookup. */
function findBrowser(): string | null {
  const candidates = [process.env.CHROMIUM, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  return candidates.find((c): c is string => Boolean(c && existsSync(c))) ?? null;
}

/**
 * Last resort for pages that refuse scripted downloads (bot protection) or build their text in
 * JavaScript: a headless Chromium renders the page and its DOM is read like any other HTML. The text
 * is cached under the same key as a plain download, so the checker then reads exactly what the
 * researcher read. PDFs are not handled here (a browser shows them in a viewer, not as text): use an
 * archived copy (web.archive.org) instead.
 */
export function extractWithBrowser(url: string): string {
  if (url.toLowerCase().split('?')[0].endsWith('.pdf')) return '';
  const key = createHash('sha1').update(url).digest('hex');
  const cached = join(CACHE, `${key}.txt`);
  if (existsSync(cached)) return readFileSync(cached, 'utf8');
  const browser = findBrowser();
  if (offline || !browser) return '';
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  try {
    const html = execFileSync(
      browser,
      [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--ignore-certificate-errors',
        ...(proxy ? [`--proxy-server=${proxy}`] : []),
        `--user-agent=${UA}`, '--lang=fr-FR', '--virtual-time-budget=15000', '--dump-dom', url,
      ],
      { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 90_000 },
    ).toString('utf8');
    const text = stripHtml(html);
    if (text.trim().length < 200 || isChallenge(text)) return '';
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cached, text);
    return text;
  } catch {
    return '';
  }
}

/** Raw HTML of a page (not cached), for listing its links: plain download, then curl, then a headless browser. */
export async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'fr' }, redirect: 'follow' });
    if (res.ok) {
      const html = await res.text();
      if (!isChallenge(stripHtml(html))) return html;
    }
  } catch {
    /* fall through */
  }
  try {
    const html = execFileSync('curl', ['-sS', '-f', '-m', '60', '-L', '-A', UA, '-H', 'accept-language: fr-FR,fr;q=0.9', url], {
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8');
    if (!isChallenge(stripHtml(html))) return html;
  } catch {
    /* fall through */
  }
  const browser = findBrowser();
  if (!browser) return '';
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  try {
    return execFileSync(
      browser,
      ['--headless=new', '--no-sandbox', '--disable-gpu', '--ignore-certificate-errors', ...(proxy ? [`--proxy-server=${proxy}`] : []), `--user-agent=${UA}`, '--lang=fr-FR', '--virtual-time-budget=15000', '--dump-dom', url],
      { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 90_000 },
    ).toString('utf8');
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

// Normalised text per URL for this process, so a source cited by many positions is read once.
const memo = new Map<string, string>();

async function normalisedSource(url: string, viaCurl: boolean): Promise<string> {
  const key = `${viaCurl ? 'curl:' : ''}${url}`;
  if (!memo.has(key)) memo.set(key, normalise(await extract(url, viaCurl)));
  return memo.get(key) as string;
}

/**
 * Does `quote` appear in the document at `url`?
 *   exact   verbatim, after normalising whitespace, apostrophes, dashes, ligatures
 *   fuzzy   at least 60 % of the quote's 4-word sequences appear — typical of PDF line breaks
 *   MISSING the quote is not in the source
 *   NOFETCH the source could not be fetched: nothing is proven either way
 */
export async function checkQuote(url: string, quote: string): Promise<QuoteLevel> {
  let source = await normalisedSource(url, false);
  const q = normalise(quote);
  let level: QuoteLevel = source ? grade(q, source) : 'NOFETCH';
  // A plain fetch sometimes returns a partial page; a full browser header set usually gets the rest.
  if (level !== 'exact' && level !== 'fuzzy') {
    const retry = await normalisedSource(url, true);
    if (retry) {
      source = `${source} ${retry}`;
      memo.set(url, source);
      level = grade(q, source);
    }
  }
  // Still nothing downloadable: render the page in a browser, when one is available.
  if (level === 'NOFETCH') {
    const rendered = normalise(extractWithBrowser(url));
    if (rendered) {
      memo.set(url, rendered);
      level = grade(q, rendered);
    }
  }
  return level;
}
