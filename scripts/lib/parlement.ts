/**
 * Official list of the parliamentary texts a sitting deputy or senator has put their name to, from the
 * open data of the Assemblée nationale and the Sénat. Shared by `data:parlement` (the research helper)
 * and `data:check-cosigners` (the integration check), so both see exactly the same list.
 *
 *   Assemblée nationale  data.assemblee-nationale.fr: active deputies (AMO10) and legislative
 *                        documents of the 17th legislature, matched on first and last name.
 *   Sénat                data.senat.fr senators list, then the senator's « propositions de loi » pages.
 *
 * Not listed on purpose: government bills (a minister signs them ex officio), censure motions, and
 * co-signatures later withdrawn. Downloads are cached for the day under .cache/parlement/.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './load.ts';
import { fetchHtml } from './sources.ts';

export interface ParliamentRow {
  date: string;
  kind: string;
  role: string;
  number: string;
  title: string;
  url: string;
  /** Same document on another official address, for when the first one is refused. */
  alt?: string;
}

export interface ParliamentListing {
  chamber: 'Assemblée nationale' | 'Sénat';
  who: string;
  rows: ParliamentRow[];
}

const day = new Date().toISOString().slice(0, 10);
const CACHE = join(ROOT, '.cache', 'parlement', day);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MONTHS: Record<string, string> = { janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12' };

function download(url: string, file: string): string {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, file);
  if (!existsSync(path)) execFileSync('curl', ['-sS', '-f', '-m', '300', '-L', '-A', UA, '-o', path, url], { stdio: ['ignore', 'ignore', 'inherit'] });
  return path;
}
function unzipOnce(zip: string, dir: string): string {
  const out = join(CACHE, dir);
  if (!existsSync(out)) {
    mkdirSync(out, { recursive: true });
    execFileSync('unzip', ['-q', '-o', zip, '-d', out]);
  }
  return out;
}
const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const asList = <T,>(x: T | T[] | null | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

interface AnDocument {
  uid: string;
  type: string;
  subType: string | undefined;
  kind: string;
  number: string;
  date: string;
  title: string;
  roles: Map<string, string>;
}

// Read once per process: the legislative documents are thousands of files, and a check over every
// candidate would otherwise parse them once per candidate.
let anActors: Map<string, string> | null = null;
let anDocuments: AnDocument[] | null = null;

function assembleeActors(): Map<string, string> {
  if (anActors) return anActors;
  const amo = unzipOnce(
    download('https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip', 'amo10.zip'),
    'amo10',
  );
  const dir = join(amo, 'json', 'acteur');
  anActors = new Map();
  for (const f of readdirSync(dir)) {
    const a = JSON.parse(readFileSync(join(dir, f), 'utf8')).acteur;
    const ident = a.etatCivil.ident;
    anActors.set(`${fold(ident.prenom)}|${fold(ident.nom)}`, typeof a.uid === 'string' ? a.uid : a.uid['#text']);
  }
  return anActors;
}

function assembleeDocuments(): AnDocument[] {
  if (anDocuments) return anDocuments;
  const dos = unzipOnce(
    download('https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip', 'dossiers.zip'),
    'dossiers',
  );
  const dir = join(dos, 'json', 'document');
  anDocuments = [];
  for (const f of readdirSync(dir)) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8')).document;
    const type = d.classification?.type?.code;
    if (!['PION', 'PNRE', 'RAPP', 'RINF'].includes(type)) continue; // no government bills, no motions
    const roles = new Map<string, string>();
    for (const a of asList(d.auteurs?.auteur)) if (a.acteur?.acteurRef) roles.set(a.acteur.acteurRef, a.acteur.qualite === 'rapporteur' ? 'rapporteur·e' : 'auteur·rice');
    for (const c of asList(d.coSignataires?.coSignataire)) if (c.acteur?.acteurRef && !c.dateRetraitCosignature && !roles.has(c.acteur.acteurRef)) roles.set(c.acteur.acteurRef, 'cosignataire');
    anDocuments.push({
      uid: d.uid,
      type,
      subType: d.classification?.sousType?.code,
      kind: d.denominationStructurelle ?? type,
      number: String(Number(d.notice?.numNotice ?? 0)),
      date: (d.cycleDeVie?.chrono?.dateDepot ?? '').slice(0, 10),
      title: d.titres?.titrePrincipal ?? '',
      roles,
    });
  }
  return anDocuments;
}

function assemblee(firstName: string, lastName: string, since: string): ParliamentListing | null {
  const ref = assembleeActors().get(`${fold(firstName)}|${fold(lastName)}`);
  if (!ref) return null;
  const rows: ParliamentRow[] = [];
  for (const d of assembleeDocuments()) {
    const role = d.roles.get(ref);
    if (!role || !d.date || d.date < since) continue;
    const num = d.number.padStart(4, '0');
    // The open-data address works for every document type; the PDF is the printed text of a bill or resolution.
    const opendata = `https://www.assemblee-nationale.fr/dyn/opendata/${d.uid}.html`;
    const pdf =
      d.type === 'PION'
        ? `https://www.assemblee-nationale.fr/dyn/17/textes/l17b${num}_proposition-loi.pdf`
        : d.type === 'PNRE'
          ? `https://www.assemblee-nationale.fr/dyn/17/textes/l17b${num}_proposition-resolution${d.subType === 'TVXINSTITEUROP' ? '-europeenne' : ''}.pdf`
          : null;
    rows.push({ date: d.date, kind: d.kind, role, number: d.number, title: d.title, url: pdf ?? opendata, ...(pdf ? { alt: opendata } : {}) });
  }
  return { chamber: 'Assemblée nationale', who: `député·e ${ref}`, rows };
}

let senators: string[] | null = null;

async function senat(firstName: string, lastName: string, since: string): Promise<ParliamentListing | null> {
  senators ??= execFileSync('iconv', ['-f', 'latin1', '-t', 'utf-8', download('https://data.senat.fr/data/senateurs/ODSEN_GENERAL.csv', 'senateurs.csv')])
    .toString('utf8')
    .split(/\r?\n/);
  const line = senators.find((l) => {
    const c = l.split(',');
    return c[4] === 'ACTIF' && fold(c[2] ?? '') === fold(lastName) && fold(c[3] ?? '') === fold(firstName);
  });
  if (!line) return null;
  const [matricule, , nom, prenom] = line.split(',');
  const slug = `${fold(nom).replace(/[^a-z]+/g, '_')}_${fold(prenom).replace(/[^a-z]+/g, '_')}${matricule.toLowerCase()}`;
  const rows: ParliamentRow[] = [];
  const firstSession = Number(since.slice(0, 4)) - (Number(since.slice(5, 7)) < 10 ? 1 : 0);
  const sessions = ['', ...Array.from({ length: 6 }, (_, i) => String(firstSession + i))];
  for (const s of sessions) {
    const html = await fetchHtml(`https://www.senat.fr/propositions-de-loi/${slug}${s}.html`);
    for (const section of html.split(/<section class="section">/).slice(1)) {
      const role = /est l'auteur/.test(section) ? 'auteur·rice' : /cosignataire/.test(section) ? 'cosignataire' : null;
      if (!role) continue;
      for (const m of section.matchAll(/<a href="\/dossier-legislatif\/([a-z]+\d+-\d+)\.html">([\s\S]*?)<\/a>[\s\S]*?<time>\s*(\d{1,2}) (\S+) (\d{4})\s*<\/time>/g)) {
        const date = `${m[5]}-${MONTHS[m[4]] ?? '01'}-${m[3].padStart(2, '0')}`;
        if (date < since || rows.some((r) => r.number === m[1])) continue;
        const title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        rows.push({ date, kind: /^Proposition de résolution/.test(title) ? 'Proposition de résolution' : 'Proposition de loi', role, number: m[1], title, url: `https://www.senat.fr/leg/${m[1]}.html` });
      }
    }
  }
  return { chamber: 'Sénat', who: `sénateur·rice ${matricule}`, rows };
}

/** The candidate's texts since `since` (AAAA-MM-JJ), newest first; null if they sit in neither chamber. */
export async function listParliamentaryTexts(firstName: string, lastName: string, since: string): Promise<ParliamentListing | null> {
  const found = assemblee(firstName, lastName, since) ?? (await senat(firstName, lastName, since));
  found?.rows.sort((a, b) => b.date.localeCompare(a.date) || a.number.localeCompare(b.number));
  return found;
}

/**
 * The bill or resolution a source URL points to, as the key `Assemblée nationale 3106` or `Sénat ppl25-455`;
 * null for anything else (a vote, a report, a programme…). Both official addresses of a bill give the same key.
 */
export function billKey(url: string): string | null {
  let m = /assemblee-nationale\.fr\/dyn\/17\/textes\/l17b0*(\d+)_proposition/.exec(url);
  if (m) return `Assemblée nationale ${m[1]}`;
  m = /assemblee-nationale\.fr\/dyn\/opendata\/(?:PION|PNRE)ANR5L17B0*(\d+)\.html/.exec(url);
  if (m) return `Assemblée nationale ${m[1]}`;
  m = /senat\.fr\/(?:leg|dossier-legislatif)\/(pp[lr]\d+-\d+)/.exec(url);
  if (m) return `Sénat ${m[1]}`;
  return null;
}
