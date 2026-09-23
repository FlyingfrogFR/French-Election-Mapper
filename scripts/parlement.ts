/**
 * `npm run -s data:parlement -- <candidateId> [--since=AAAA-MM-JJ] [--json]`
 *
 * Lists, from the official open data, the parliamentary texts a sitting deputy or senator has put
 * their name to since a date (default: start of the 17th legislature, 2024-07-18): bills and
 * resolutions they authored or co-signed, and reports they wrote as rapporteur. The same deterministic
 * listing is used for every parliamentarian, so none is researched more thoroughly than another.
 *
 *   Assemblée nationale  data.assemblee-nationale.fr: active deputies (AMO10) and legislative
 *                        documents of the 17th legislature, matched on first and last name.
 *   Sénat                data.senat.fr senators list, then the senator's « propositions de loi » pages.
 *
 * Not listed on purpose: government bills (a minister signs them ex officio), censure motions, and
 * co-signatures later withdrawn. The list says what exists, not what it means: each text still has to
 * be read, and encoded only where its object is exactly the measure of a statement.
 * Downloads are cached for the day under .cache/parlement/.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadRawData, ROOT } from './lib/load.ts';
import { fetchHtml } from './lib/sources.ts';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const since = args.find((a) => a.startsWith('--since='))?.slice('--since='.length) ?? '2024-07-18';
const asJson = args.includes('--json');

const raw = loadRawData();
const candidate = raw.candidatesFile.candidates.find((c) => c.id === id);
if (!candidate) {
  console.error(`Candidat·e inconnu·e : ${id ?? '(aucun identifiant)'}`);
  process.exit(2);
}

const day = new Date().toISOString().slice(0, 10);
const CACHE = join(ROOT, '.cache', 'parlement', day);
mkdirSync(CACHE, { recursive: true });
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function download(url: string, file: string): string {
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

interface Row {
  date: string;
  kind: string;
  role: string;
  number: string;
  title: string;
  url: string;
  /** Same document on another official address, for when the first one is refused. */
  alt?: string;
}

const MONTHS: Record<string, string> = { janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12' };

function assemblee(): { who: string; rows: Row[] } | null {
  const amo = unzipOnce(
    download('https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip', 'amo10.zip'),
    'amo10',
  );
  const actorDir = join(amo, 'json', 'acteur');
  let ref: string | null = null;
  for (const f of readdirSync(actorDir)) {
    const a = JSON.parse(readFileSync(join(actorDir, f), 'utf8')).acteur;
    const ident = a.etatCivil.ident;
    if (fold(ident.nom) === fold(candidate!.lastName) && fold(ident.prenom) === fold(candidate!.firstName)) {
      ref = typeof a.uid === 'string' ? a.uid : a.uid['#text'];
      break;
    }
  }
  if (!ref) return null;
  const dos = unzipOnce(
    download('https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip', 'dossiers.zip'),
    'dossiers',
  );
  const docDir = join(dos, 'json', 'document');
  const rows: Row[] = [];
  for (const f of readdirSync(docDir)) {
    const d = JSON.parse(readFileSync(join(docDir, f), 'utf8')).document;
    const type = d.classification?.type?.code;
    if (!['PION', 'PNRE', 'RAPP', 'RINF'].includes(type)) continue; // no government bills, no motions
    let role: string | null = null;
    for (const a of asList(d.auteurs?.auteur)) if (a.acteur?.acteurRef === ref) role = a.acteur.qualite === 'rapporteur' ? 'rapporteur·e' : 'auteur·rice';
    for (const c of asList(d.coSignataires?.coSignataire)) if (c.acteur?.acteurRef === ref && !c.dateRetraitCosignature) role ??= 'cosignataire';
    if (!role) continue;
    const date = (d.cycleDeVie?.chrono?.dateDepot ?? '').slice(0, 10);
    if (!date || date < since) continue;
    const num = String(d.notice?.numNotice ?? '').padStart(4, '0');
    const sub = d.classification?.sousType?.code;
    // The open-data address works for every document type; the PDF is the printed text of a bill or resolution.
    const opendata = `https://www.assemblee-nationale.fr/dyn/opendata/${d.uid}.html`;
    const pdf =
      type === 'PION'
        ? `https://www.assemblee-nationale.fr/dyn/17/textes/l17b${num}_proposition-loi.pdf`
        : type === 'PNRE'
          ? `https://www.assemblee-nationale.fr/dyn/17/textes/l17b${num}_proposition-resolution${sub === 'TVXINSTITEUROP' ? '-europeenne' : ''}.pdf`
          : null;
    rows.push({ date, kind: d.denominationStructurelle ?? type, role, number: String(Number(num)), title: d.titres?.titrePrincipal ?? '', url: pdf ?? opendata, ...(pdf ? { alt: opendata } : {}) });
  }
  return { who: `député·e ${ref}`, rows };
}

async function senat(): Promise<{ who: string; rows: Row[] } | null> {
  const csv = execFileSync('iconv', ['-f', 'latin1', '-t', 'utf-8', download('https://data.senat.fr/data/senateurs/ODSEN_GENERAL.csv', 'senateurs.csv')]).toString('utf8');
  const line = csv.split(/\r?\n/).find((l) => {
    const c = l.split(',');
    return c[4] === 'ACTIF' && fold(c[2] ?? '') === fold(candidate!.lastName) && fold(c[3] ?? '') === fold(candidate!.firstName);
  });
  if (!line) return null;
  const [matricule, , nom, prenom] = line.split(',');
  const slug = `${fold(nom).replace(/[^a-z]+/g, '_')}_${fold(prenom).replace(/[^a-z]+/g, '_')}${matricule.toLowerCase()}`;
  const rows: Row[] = [];
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
  return { who: `sénateur·rice ${matricule}`, rows };
}

const found = assemblee() ?? (await senat());
if (!found) {
  console.log(asJson ? JSON.stringify({ candidateId: id, parliamentarian: false, rows: [] }) : `${candidate.displayName} ne siège ni à l'Assemblée nationale ni au Sénat (données ouvertes du ${day}).`);
  process.exit(0);
}
found.rows.sort((a, b) => b.date.localeCompare(a.date) || a.number.localeCompare(b.number));
if (asJson) {
  console.log(JSON.stringify({ candidateId: id, parliamentarian: found.who, since, rows: found.rows }, null, 1));
} else {
  console.log(`# ${candidate.displayName}, ${found.who} — ${found.rows.length} texte(s) depuis le ${since}`);
  for (const r of found.rows) console.log(`${r.date} · ${r.kind} n°${r.number} · ${r.role}\n  ${r.title}\n  ${r.url}${r.alt ? `\n  (aussi : ${r.alt})` : ''}`);
}
