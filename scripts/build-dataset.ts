/**
 * `npm run data:build` — validates data/, derives the dataset and writes:
 *   - src/generated/dataset.json   (imported by the app at build time)
 *   - public/data/dataset.json     (served as-is so third parties can download and audit it)
 *   - public/data/updates.xml      (RSS feed of declarations, for weekly follow-up)
 *   - public/data/VERSION          (dataset hash, one line)
 * The output is deterministic except for `generatedAt` (override with SOURCE_DATE_EPOCH for reproducible builds).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataError, loadRawData, ROOT } from './lib/load.ts';
import { deriveDataset } from './lib/derive.ts';
import type { Dataset } from '../src/lib/schema.ts';

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string);
}

function rss(ds: Dataset, siteUrl: string): string {
  const names = new Map(ds.candidates.map((c) => [c.id, c.displayName]));
  const items = ds.declarations
    .slice(0, 100)
    .map(
      (d) => `    <item>
      <title>${escapeXml(`${names.get(d.candidateId) ?? d.candidateId} — ${d.title}`)}</title>
      <link>${escapeXml(d.sourceUrl)}</link>
      <guid isPermaLink="false">${escapeXml(d.id)}</guid>
      <pubDate>${new Date(`${d.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(d.summary)} (${d.positionCount} position(s) renseignée(s), statut : ${d.review.status})</description>
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Boussole présidentielle 2027 — déclarations des candidats</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Journal des déclarations sourcées utilisées par la boussole. Version du jeu de données : ${ds.version}</description>
    <language>fr</language>
    <lastBuildDate>${new Date(ds.generatedAt).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

try {
  const raw = loadRawData();
  const generatedAt = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : new Date().toISOString();
  const dataset = deriveDataset(raw, generatedAt);
  // Full audit copy: everything, including every quote and every declaration's positions.
  const json = JSON.stringify(dataset, null, 2);

  // Bundled copy: same positions and provenance, but the verbatim quotes and the declarations'
  // position lists are left out. They are large and only needed on demand, so the app fetches
  // quotes.json when it actually displays a quote. Nothing else differs.
  const quotes: Record<string, { quote: string; page?: string }> = {};
  const app = {
    ...dataset,
    candidates: dataset.candidates.map((c) => ({
      ...c,
      positions: Object.fromEntries(
        Object.entries(c.positions).map(([qid, p]) => {
          if (p.quote) quotes[`${c.id}|${qid}`] = { quote: p.quote, ...(p.page ? { page: p.page } : {}) };
          const { quote: _quote, page: _page, ...rest } = p;
          return [qid, rest];
        }),
      ),
    })),
    declarations: dataset.declarations.map(({ positions: _positions, ...d }) => d),
  };
  const compact = JSON.stringify(app);

  const generatedDir = join(ROOT, 'src', 'generated');
  const publicDir = join(ROOT, 'public', 'data');
  mkdirSync(generatedDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(generatedDir, 'dataset.json'), compact);
  writeFileSync(join(publicDir, 'dataset.json'), json);
  writeFileSync(join(publicDir, 'VERSION'), `${dataset.version}\n`);
  writeFileSync(join(publicDir, 'quotes.json'), JSON.stringify(quotes));
  writeFileSync(join(publicDir, 'updates.xml'), rss(dataset, process.env.VITE_SITE_URL ?? 'https://example.org/'));

  console.log(
    `✔ Jeu de données ${dataset.version} généré : ${dataset.stats.candidates} candidats, ${dataset.stats.questions} questions, ${dataset.stats.positions} positions (${dataset.stats.verified} vérifiées, ${dataset.stats.pending} en attente, ${dataset.stats.disputed} contestées). Dernière déclaration : ${dataset.stats.lastDeclarationDate ?? 'aucune'}.`,
  );
} catch (e) {
  if (e instanceof DataError) {
    console.error(`✘ ${e.message}`);
    process.exit(1);
  }
  throw e;
}
