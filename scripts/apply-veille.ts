/**
 * `npm run data:apply-veille -- <résultat.json> [--report=<rapport.md>]`
 *
 * Applies the result of the weekly research (`.claude/workflows/veille-hebdo.js`) to data/, and writes
 * a report for the pull request. Deterministic on purpose: the agents only propose; what enters the
 * data is decided by the two adversarial reviews (already merged into `accepted` by the workflow) and
 * by the rules below, then re-checked by `npm run check` and `npm run data:check-quotes`.
 *
 * Every added declaration is `pending`: only a second person can mark it verified.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, loadRawData } from './lib/load.ts';
import { CANDIDATE_STATUSES, CandidateSchema, DeclarationSchema, SOURCE_TYPES, type Candidate, type Declaration } from '../src/lib/schema.ts';

interface ProposedPosition {
  questionId: string;
  value: number;
  quote: string;
  sourceUrl?: string;
  page?: string;
  inferred?: boolean;
  note?: string;
  previousValue?: number | null;
}
interface ProposedDeclaration extends Omit<Declaration, 'positions' | 'review'> {
  positions: ProposedPosition[];
}
interface Rejection {
  declarationId: string;
  questionId: string | null;
  reason: string;
}
interface CandidateResult {
  id: string;
  failed?: boolean;
  searched?: string;
  statusNews?: string;
  problems?: string[];
  proposed?: number;
  accepted?: ProposedDeclaration[];
  rejected?: Rejection[];
  website?: string;
}
interface StatusChange {
  candidateId: string;
  status: Candidate['status'];
  declaredOn: string | null;
  statusNote: string;
  primary: string | null;
  sources: Candidate['sources'];
  verdict: 'proposed' | 'accept' | 'reject';
  reason: string;
}
interface NewCandidate extends Candidate {
  verdict: 'proposed' | 'accept' | 'reject';
  reason: string;
}
interface VeilleResult {
  window: { since: string; today: string };
  status: { changes: StatusChange[]; newCandidates: NewCandidate[]; primaries: string; notes: string } | null;
  candidates: CandidateResult[];
}

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const reportPath = args.find((a) => a.startsWith('--report='))?.slice('--report='.length);
if (!input) {
  console.error('Usage : npm run data:apply-veille -- <résultat.json> [--report=<rapport.md>]');
  process.exit(2);
}

const result = JSON.parse(readFileSync(input, 'utf8')) as VeilleResult;
const raw = loadRawData();
const questionIds = new Set(raw.questions.map((q) => q.id));
const statement = new Map(raw.questions.map((q) => [q.id, q.statement]));
const candidatesFile = raw.candidatesFile;
const byId = new Map(candidatesFile.candidates.map((c) => [c.id, c]));
const files = new Map(raw.declarationFiles.map((f) => [f.candidateId, f]));
const allDeclIds = new Set(raw.declarationFiles.flatMap((f) => f.declarations.map((d) => d.id)));
const today = result.window.today;
const isUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);
const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const signed = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v > 0 ? `+${v}` : `${v}`);

const report: string[] = [];
const added: string[] = [];
const changes: string[] = [];
const skipped: string[] = [];
const statusLines: string[] = [];
const nothing: string[] = [];
const dirty = new Set<string>();
// New declarations per candidate: written above the existing ones, whose order is left untouched to keep diffs readable.
const fresh = new Map<string, Declaration[]>();
let positionsAdded = 0;
let declarationsAdded = 0;

// ---- Candidacy statuses (only what the adversarial review accepted) ----------------------------------
for (const ch of result.status?.changes ?? []) {
  const c = byId.get(ch.candidateId);
  if (ch.verdict !== 'accept') {
    const why = ch.verdict === 'reject' ? 'écarté en relecture' : 'non tranché en relecture, non appliqué';
    statusLines.push(`- ~~${c?.displayName ?? ch.candidateId}~~ : ${why} — ${ch.reason}`);
    continue;
  }
  if (!c || !CANDIDATE_STATUSES.includes(ch.status) || (ch.primary && !candidatesFile.primaries[ch.primary])) {
    statusLines.push(`- ${ch.candidateId} : changement ignoré (candidat·e, statut ou primaire inconnu)`);
    continue;
  }
  const sources = ch.sources.filter((s) => isUrl(s.url) && isDate(s.date) && s.title.length >= 3);
  if (!sources.length) {
    statusLines.push(`- ${c.displayName} : changement ignoré (aucune source datée)`);
    continue;
  }
  const before = `${c.status}${c.declaredOn ? ` (${c.declaredOn})` : ''}`;
  c.status = ch.status;
  c.declaredOn = isDate(ch.declaredOn) ? ch.declaredOn : c.declaredOn;
  c.statusNote = ch.statusNote || c.statusNote;
  c.primary = ch.primary;
  const known = new Set(c.sources.map((s) => s.url));
  c.sources = [...sources.filter((s) => !known.has(s.url)), ...c.sources];
  dirty.add('candidates');
  statusLines.push(`- **${c.displayName}** : ${before} → ${c.status}${c.declaredOn ? ` (${c.declaredOn})` : ''} — ${c.statusNote} Sources : ${sources.map((s) => `[${s.title}](${s.url})`).join(', ')}`);
}
for (const n of result.status?.newCandidates ?? []) {
  if (n.verdict !== 'accept') {
    const why = n.verdict === 'reject' ? 'écartée en relecture' : 'non tranchée en relecture, non appliquée';
    statusLines.push(`- ~~Nouvelle candidature ${n.displayName}~~ : ${why} — ${n.reason}`);
    continue;
  }
  if (byId.has(n.id) || !/^[a-z0-9-]+$/.test(n.id)) {
    statusLines.push(`- Nouvelle candidature ${n.displayName} ignorée : identifiant « ${n.id} » invalide ou déjà pris`);
    continue;
  }
  const { verdict: _v, reason: _r, ...candidate } = n;
  const sources = candidate.sources.filter((s) => isUrl(s.url) && isDate(s.date));
  if (!sources.length) continue;
  const c: Candidate = { ...candidate, sources, website: isUrl(candidate.website) ? candidate.website : null, primary: candidate.primary && candidatesFile.primaries[candidate.primary] ? candidate.primary : null };
  const valid = CandidateSchema.safeParse(c);
  if (!valid.success) {
    statusLines.push(`- Nouvelle candidature ${n.displayName} ignorée : ${valid.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')}`);
    continue;
  }
  candidatesFile.candidates.push(c);
  byId.set(c.id, c);
  files.set(c.id, { candidateId: c.id, declarations: [] });
  dirty.add('candidates');
  dirty.add(c.id);
  statusLines.push(`- **Nouvelle candidature : ${c.displayName}** (${c.party}) — ${c.statusNote} Sources : ${sources.map((s) => `[${s.title}](${s.url})`).join(', ')}`);
}

// ---- Declarations ------------------------------------------------------------------------------------
for (const r of result.candidates) {
  const c = byId.get(r.id);
  const file = files.get(r.id);
  if (!c || !file) {
    skipped.push(`- ${r.id} : candidat·e inconnu·e, résultat ignoré`);
    continue;
  }
  if (r.website && isUrl(r.website) && !c.website) {
    c.website = r.website;
    dirty.add('candidates');
  }
  const accepted = r.accepted ?? [];
  if (!accepted.length) nothing.push(`- **${c.displayName}**${r.failed ? ' (recherche interrompue : à refaire)' : ''} : ${(r.searched || '—').replace(/\s+/g, ' ').slice(0, 600)}`);
  for (const d of accepted) {
    if (!isDate(d.date) || !isUrl(d.sourceUrl) || !SOURCE_TYPES.includes(d.sourceType) || d.sourceType === 'presse') {
      skipped.push(`- ${c.displayName} · « ${d.title} » : ignorée (date, URL ou type invalide)`);
      continue;
    }
    if (file.declarations.some((x) => x.sourceUrl === d.sourceUrl && x.date === d.date)) {
      skipped.push(`- ${c.displayName} · « ${d.title} » : déjà enregistrée`);
      continue;
    }
    let id = /^[a-z0-9-]+$/.test(d.id) ? d.id : `${c.id}-${d.date.slice(0, 7)}-veille`;
    for (let i = 2; allDeclIds.has(id); i++) id = `${id.replace(/-\d+$/, '')}-${i}`;
    const seen = new Set<string>();
    const positions: Declaration['positions'] = [];
    for (const p of d.positions) {
      if (!questionIds.has(p.questionId) || seen.has(p.questionId) || ![-2, -1, 0, 1, 2].includes(p.value) || !p.quote || p.quote.trim().length < 8) {
        skipped.push(`- ${c.displayName} · ${p.questionId} : position ignorée (question inconnue, en double, valeur ou citation invalide)`);
        continue;
      }
      seen.add(p.questionId);
      positions.push({
        questionId: p.questionId,
        value: p.value as Declaration['positions'][number]['value'],
        quote: p.quote.trim(),
        ...(isUrl(p.sourceUrl) && p.sourceUrl !== d.sourceUrl ? { sourceUrl: p.sourceUrl } : {}),
        ...(p.page ? { page: p.page } : {}),
        ...(p.inferred ? { inferred: true } : {}),
        ...(p.note ? { note: p.note } : {}),
      });
      const prev = p.previousValue ?? null;
      if (prev !== null && prev !== p.value) {
        changes.push(`- **${c.displayName}** · \`${p.questionId}\` ${statement.get(p.questionId)} : ${signed(prev)} → **${signed(p.value)}** — « ${p.quote.trim().slice(0, 220)} » ([source](${isUrl(p.sourceUrl) ? p.sourceUrl : d.sourceUrl}))`);
      }
    }
    if (!positions.length) continue;
    const draft: Declaration = {
      id,
      date: d.date,
      title: d.title,
      sourceType: d.sourceType,
      sourceUrl: d.sourceUrl,
      publisher: d.publisher,
      summary: d.summary,
      review: {
        status: 'pending',
        reviewers: [],
        reviewedOn: null,
        notes: `Ajoutée par la veille automatisée du ${today} : recherche, puis deux relectures adverses automatisées (fidélité de l'encodage, provenance et exactitude des citations). Relecture par une seconde personne requise avant passage en « verified ».`,
      },
      positions,
    };
    // The schema is the last word: a malformed proposal is reported, never allowed to break the data set.
    const valid = DeclarationSchema.safeParse(draft);
    if (!valid.success) {
      skipped.push(`- ${c.displayName} · « ${d.title} » : ignorée (${valid.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')})`);
      continue;
    }
    const decl = draft;
    fresh.set(c.id, [...(fresh.get(c.id) ?? []), decl]);
    allDeclIds.add(id);
    dirty.add(c.id);
    declarationsAdded++;
    positionsAdded += positions.length;
    added.push(`- **${c.displayName}** · ${d.date} · [${d.title}](${d.sourceUrl}) (${d.sourceType}, ${d.publisher}) — ${positions.length} position(s) : ${positions.map((p) => `\`${p.questionId}\` ${signed(p.value)}`).join(', ')}`);
  }
  const rejected = r.rejected ?? [];
  if (rejected.length) {
    const decls = rejected.filter((x) => !x.questionId);
    const pos = rejected.filter((x) => x.questionId);
    skipped.push(
      `- ${c.displayName} : ${decls.length} déclaration(s) et ${pos.length} position(s) écartées en relecture${[...decls, ...pos]
        .slice(0, 6)
        .map((x) => `\n  - ${x.questionId ? `\`${x.questionId}\`` : x.declarationId} : ${x.reason.replace(/\s+/g, ' ').slice(0, 200)}`)
        .join('')}${rejected.length > 6 ? `\n  - … et ${rejected.length - 6} autre(s)` : ''}`,
    );
  }
}

// ---- Write -------------------------------------------------------------------------------------------
const write = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
for (const id of dirty) {
  if (id === 'candidates') continue;
  const f = files.get(id)!;
  const added = (fresh.get(id) ?? []).sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
  write(join(DATA_DIR, 'declarations', `${id}.json`), { ...f, declarations: [...added, ...f.declarations] });
}
if (dirty.has('candidates')) write(join(DATA_DIR, 'candidates.json'), candidatesFile);

// ---- Report ------------------------------------------------------------------------------------------
report.push(`Veille du ${result.window.since} au ${today} : **${declarationsAdded} déclaration(s)** et **${positionsAdded} position(s)** ajoutées, toutes « en attente de vérification ».`);
report.push('', '### Déclarations ajoutées', added.length ? added.join('\n') : 'Aucune.');
report.push('', '### Positions qui changent', changes.length ? changes.join('\n') : 'Aucune : les positions ajoutées complètent ou confirment les positions existantes.');
report.push('', '### Candidatures', statusLines.length ? statusLines.join('\n') : 'Aucun changement de statut établi.');
if (result.status?.primaries) report.push('', `Primaires : ${result.status.primaries}`);
report.push('', '### Écarté', skipped.length ? skipped.join('\n') : 'Rien.');
report.push('', '<details><summary>Candidat·es sans nouvelle publication officielle retenue</summary>', '', nothing.join('\n') || '—', '', '</details>');
const text = report.join('\n');
if (reportPath) writeFileSync(reportPath, `${text}\n`);
console.log(text);
