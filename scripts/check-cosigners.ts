/**
 * `npm run -s data:check-cosigners`
 *
 * Rule 8 of the research procedure says that a bill or resolution commits each of its signatories to its
 * measures. This check verifies that the data applies it evenly: for every bill or resolution of the
 * Assemblée nationale or the Sénat that grounds a position, it lists the candidates who signed it
 * (official open data, through the same listing as `data:parlement`) and reports:
 *
 *   different values   two signatories hold different positions from the same text on the same statement
 *   missing            a signatory holds no position from the text and no more recent position on the statement
 *   not a signatory    the data attributes the text to a candidate the open data does not list as a signatory
 *
 * A text whose position was judged doubtful and removed for every signatory raises nothing: the rule is
 * « même encodage pour tou·tes, ou personne ». Exit code 1 if anything is reported.
 */
import { loadRawData } from './lib/load.ts';
import { deriveDataset } from './lib/derive.ts';
import { billKey, listParliamentaryTexts } from './lib/parlement.ts';

const SINCE = '2024-07-18';
const raw = loadRawData();
const ds = deriveDataset(raw, new Date().toISOString());
const names = new Map(raw.candidatesFile.candidates.map((c) => [c.id, c.displayName]));

// Who signed what, per the official listing (authors and co-signatories of bills and resolutions only).
const signed = new Map<string, Set<string>>();
for (const c of raw.candidatesFile.candidates) {
  const listing = await listParliamentaryTexts(c.firstName, c.lastName, SINCE);
  if (!listing) continue;
  const keys = new Set<string>();
  for (const r of listing.rows) {
    if (r.role === 'rapporteur·e') continue;
    const key = billKey(r.url) ?? (listing.chamber === 'Sénat' ? `Sénat ${r.number}` : null);
    if (key) keys.add(key);
  }
  signed.set(c.id, keys);
  console.log(`${c.displayName} : ${keys.size} proposition(s) de loi ou de résolution (${listing.chamber})`);
}

// What the data says, text by text and statement by statement.
interface Held {
  value: number;
  inferred: boolean;
  date: string;
  declarationId: string;
}
const byText = new Map<string, Map<string, Map<string, Held>>>();
for (const f of raw.declarationFiles) {
  for (const d of f.declarations) {
    for (const p of d.positions) {
      const key = billKey(p.sourceUrl ?? d.sourceUrl);
      if (!key) continue;
      const questions = byText.get(key) ?? new Map<string, Map<string, Held>>();
      const holders = questions.get(p.questionId) ?? new Map<string, Held>();
      holders.set(f.candidateId, { value: p.value, inferred: Boolean(p.inferred), date: d.date, declarationId: d.id });
      questions.set(p.questionId, holders);
      byText.set(key, questions);
    }
  }
}

const current = new Map(ds.candidates.map((c) => [c.id, c.positions]));
const show = (h: Held) => `${h.value > 0 ? '+' : ''}${h.value}${h.inferred ? ' déduite' : ''}`;
const problems: string[] = [];
let pairs = 0;
for (const [key, questions] of [...byText].sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric: true }))) {
  const signatories = [...signed].filter(([, keys]) => keys.has(key)).map(([id]) => id);
  for (const [questionId, holders] of questions) {
    pairs++;
    const values = new Set([...holders.values()].map(show));
    if (values.size > 1) {
      problems.push(`${key} · ${questionId} : valeurs différentes — ${[...holders].map(([id, h]) => `${names.get(id)} ${show(h)}`).join(', ')}`);
    }
    for (const id of holders.keys()) {
      if (!signatories.includes(id)) problems.push(`${key} · ${questionId} : ${names.get(id)} n'en est pas signataire selon les données ouvertes`);
    }
    const date = [...holders.values()][0].date;
    for (const id of signatories) {
      if (holders.has(id)) continue;
      const now = current.get(id)?.[questionId];
      if (now && now.date >= date) continue; // a more recent (or same-day) source already covers the statement
      problems.push(`${key} · ${questionId} : ${names.get(id)}, signataire, n'a pas cette position${now ? ` (position actuelle ${now.value > 0 ? '+' : ''}${now.value}, plus ancienne : ${now.date})` : ''} — ${[...holders].map(([hid, h]) => `${names.get(hid)} ${show(h)}`).join(', ')}`);
    }
  }
}

console.log(`\n${byText.size} texte(s) parlementaire(s) fondent ${pairs} couple(s) texte × affirmation.`);
if (problems.length) {
  console.log(`\n✘ ${problems.length} écart(s) à la règle 8 :\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('✔ Chaque texte donne la même position à tou·tes ses signataires candidat·es.');
