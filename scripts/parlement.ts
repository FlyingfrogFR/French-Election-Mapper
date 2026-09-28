/**
 * `npm run -s data:parlement -- <candidateId> [--since=AAAA-MM-JJ] [--json]`
 *
 * Lists, from the official open data, the parliamentary texts a sitting deputy or senator has put
 * their name to since a date (default: start of the 17th legislature, 2024-07-18): bills and
 * resolutions they authored or co-signed, and reports they wrote as rapporteur. The same deterministic
 * listing is used for every parliamentarian, so none is researched more thoroughly than another
 * (see scripts/lib/parlement.ts for the sources).
 *
 * The list says what exists, not what it means: each text still has to be read, and encoded only where
 * its object is exactly the measure of a statement.
 */
import { loadRawData } from './lib/load.ts';
import { listParliamentaryTexts } from './lib/parlement.ts';

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

const found = await listParliamentaryTexts(candidate.firstName, candidate.lastName, since);
if (!found) {
  const day = new Date().toISOString().slice(0, 10);
  console.log(asJson ? JSON.stringify({ candidateId: id, parliamentarian: false, rows: [] }) : `${candidate.displayName} ne siège ni à l'Assemblée nationale ni au Sénat (données ouvertes du ${day}).`);
  process.exit(0);
}
if (asJson) {
  console.log(JSON.stringify({ candidateId: id, parliamentarian: found.who, since, rows: found.rows }, null, 1));
} else {
  console.log(`# ${candidate.displayName}, ${found.who} — ${found.rows.length} texte(s) depuis le ${since}`);
  for (const r of found.rows) console.log(`${r.date} · ${r.kind} n°${r.number} · ${r.role}\n  ${r.title}\n  ${r.url}${r.alt ? `\n  (aussi : ${r.alt})` : ''}`);
}
