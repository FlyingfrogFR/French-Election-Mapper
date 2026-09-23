/**
 * `npm run -s data:brief -- <candidateId>`
 *
 * Everything needed before researching a candidate's new declarations, in one screen: status and
 * official site, the declarations already recorded (so a source is never added twice), and the 163
 * statements with the candidate's current position on each — the reference against which a new
 * document is encoded.
 */
import { loadRawData } from './lib/load.ts';
import { deriveDataset } from './lib/derive.ts';
import { CANDIDATE_STATUS_LABELS } from '../src/lib/schema.ts';

const id = process.argv.slice(2).find((a) => !a.startsWith('--'));
const raw = loadRawData();
const ds = deriveDataset(raw, new Date().toISOString());
const c = ds.candidates.find((x) => x.id === id);
if (!c) {
  console.error(`Candidat·e inconnu·e : ${id ?? '(aucun identifiant)'}. Identifiants : ${ds.candidates.map((x) => x.id).join(', ')}`);
  process.exit(2);
}

const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const out: string[] = [];
out.push(`# ${c.displayName} — ${c.party} (${c.partyShort})`);
out.push(`Statut : ${CANDIDATE_STATUS_LABELS[c.status]}${c.declaredOn ? ` depuis le ${c.declaredOn}` : ''}${c.primary ? ` · primaire : ${ds.primaries[c.primary]?.name ?? c.primary}` : ''}`);
out.push(`Note de statut : ${c.statusNote ?? '—'}`);
out.push(`Site officiel connu : ${c.website ?? 'aucun (à trouver)'}`);
out.push(`Positions documentées : ${c.stats.known} / ${ds.stats.questions} · dernière déclaration : ${c.lastUpdated ?? 'aucune'}`);
out.push('');
out.push(`## Déclarations déjà enregistrées (${c.stats.declarations}) — ne pas les ajouter à nouveau`);
const decls = ds.declarations.filter((d) => d.candidateId === c.id);
if (!decls.length) out.push('(aucune)');
for (const d of decls) out.push(`- ${d.date} · ${d.id} · ${d.sourceType} · ${d.publisher} · ${d.positionCount} position(s)\n  ${d.sourceUrl}`);
out.push('');
out.push('## Affirmations et position actuelle');
out.push('Format : identifiant [valeur actuelle · date · déclaration] énoncé');
for (const topic of ds.topics) {
  out.push(`\n### ${topic.title}`);
  for (const q of ds.questions.filter((x) => x.topic === topic.id)) {
    const p = c.positions[q.id];
    const cur = p ? `[${signed(p.value)} · ${p.date} · ${p.declarationId}${p.inferred ? ' · déduite' : ''}]` : '[—]';
    out.push(`${q.id} ${cur} ${q.statement}`);
  }
}
console.log(out.join('\n'));
