/**
 * `npm run data:freshness [-- --json | --markdown]`
 * Reports, per candidate, when their positions were last updated and how many are pending review.
 * The weekly GitHub Action turns the markdown output into a checklist issue.
 */
import { loadRawData } from './lib/load.ts';
import { deriveDataset } from './lib/derive.ts';
import { CANDIDATE_STATUS_LABELS } from '../src/lib/schema.ts';

const STALE_DAYS = Number(process.env.STALE_DAYS ?? 7);
const today = process.env.TODAY ? new Date(process.env.TODAY) : new Date();

const raw = loadRawData();
const ds = deriveDataset(raw, today.toISOString());

function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor((today.getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000);
}

const rows = ds.candidates.map((c) => {
  const age = daysSince(c.lastUpdated);
  return {
    id: c.id,
    name: c.displayName,
    party: c.partyShort,
    status: c.status,
    lastUpdated: c.lastUpdated,
    daysSinceUpdate: age,
    stale: age === null || age > STALE_DAYS,
    positions: c.stats.known,
    coverage: Math.round((c.stats.known / ds.stats.questions) * 100),
    pending: c.stats.pending,
    verified: c.stats.verified,
    disputed: c.stats.disputed,
  };
});

const summary = {
  datasetVersion: ds.version,
  today: today.toISOString().slice(0, 10),
  staleDays: STALE_DAYS,
  lastDeclarationDate: ds.stats.lastDeclarationDate,
  totals: ds.stats,
  candidates: rows,
};

const mode = process.argv.includes('--json') ? 'json' : process.argv.includes('--markdown') ? 'markdown' : 'table';

if (mode === 'json') {
  console.log(JSON.stringify(summary, null, 2));
} else if (mode === 'markdown') {
  const lines = [
    `Jeu de données \`${ds.version}\` — ${ds.stats.positions} positions dont **${ds.stats.pending} en attente de vérification** et ${ds.stats.disputed} contestées. Dernière déclaration enregistrée : ${ds.stats.lastDeclarationDate ?? 'aucune'}.`,
    '',
    `Cocher chaque candidat après avoir recherché ses prises de position de la semaine (programme, discours, votes, entretiens) et ouvert une PR le cas échéant. Seuil de fraîcheur : ${STALE_DAYS} jours.`,
    '',
    '| ✔ | Candidat | Statut | Positions | Couverture | En attente | Dernière mise à jour |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| [ ] | ${r.name} (${r.party}) | ${CANDIDATE_STATUS_LABELS[r.status]} | ${r.positions} | ${r.coverage} % | ${r.pending} | ${r.lastUpdated ?? '—'}${r.stale ? ' ⚠️' : ''} |`,
    ),
    '',
    '⚠️ = aucune déclaration enregistrée depuis plus de ' + STALE_DAYS + ' jours (ou jamais).',
  ];
  console.log(lines.join('\n'));
} else {
  console.table(rows.map(({ id: _id, ...r }) => r));
  console.log(`Dataset ${ds.version} · ${ds.stats.pending} positions en attente de vérification.`);
}
