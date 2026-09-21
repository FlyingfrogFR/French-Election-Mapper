/**
 * `npm run data:validate` — fails (exit code 1) if any data file is malformed or inconsistent.
 * Run in CI on every pull request so that no unsourced or malformed position can be merged.
 */
import { DataError, loadRawData } from './lib/load.ts';

try {
  const raw = loadRawData();
  const positions = raw.declarationFiles.reduce((n, f) => n + f.declarations.reduce((m, d) => m + d.positions.length, 0), 0);
  console.log(
    `✔ Données valides : ${raw.topics.length} thèmes, ${raw.questions.length} questions, ${raw.candidatesFile.candidates.length} candidats, ${positions} positions déclarées.`,
  );
} catch (e) {
  if (e instanceof DataError) {
    console.error(`✘ ${e.message}`);
    process.exit(1);
  }
  throw e;
}
