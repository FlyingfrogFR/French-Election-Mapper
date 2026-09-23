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
import { loadRawData } from './lib/load.ts';
import { checkQuote, setOffline } from './lib/sources.ts';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--candidate='))?.split('=')[1];
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0');
setOffline(args.includes('--offline'));

const raw = loadRawData();
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
      const level = await checkQuote(url, pos.quote);
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
