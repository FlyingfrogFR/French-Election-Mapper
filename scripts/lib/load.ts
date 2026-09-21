/**
 * Loads and validates the raw data files. Used by every script so validation rules live in one place.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CandidatesFileSchema,
  DeclarationsFileSchema,
  QuestionSchema,
  TopicSchema,
  type CandidatesFile,
  type DeclarationsFile,
  type Question,
  type Topic,
} from '../../src/lib/schema.ts';
import { z } from 'zod';

export const ROOT = resolve(import.meta.dirname, '..', '..');
export const DATA_DIR = join(ROOT, 'data');

export interface RawData {
  topics: Topic[];
  questions: Question[];
  candidatesFile: CandidatesFile;
  declarationFiles: DeclarationsFile[];
}

export class DataError extends Error {}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new DataError(`Impossible de lire ${path} : ${(e as Error).message}`);
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `  - ${i.path.join('.') || '(racine)'} : ${i.message}`).join('\n');
    throw new DataError(`Schéma invalide dans ${file} :\n${issues}`);
  }
  return r.data;
}

/** Cross-file consistency rules that a schema alone cannot express. */
function checkConsistency(d: RawData): string[] {
  const errors: string[] = [];
  const topicIds = new Set(d.topics.map((t) => t.id));
  const questionIds = new Set<string>();
  for (const q of d.questions) {
    if (questionIds.has(q.id)) errors.push(`Question dupliquée : ${q.id}`);
    questionIds.add(q.id);
    if (!topicIds.has(q.topic)) errors.push(`Question ${q.id} : thème inconnu « ${q.topic} »`);
  }
  const candidateIds = new Set<string>();
  for (const c of d.candidatesFile.candidates) {
    if (candidateIds.has(c.id)) errors.push(`Candidat dupliqué : ${c.id}`);
    candidateIds.add(c.id);
    if (c.primary && !d.candidatesFile.primaries[c.primary]) errors.push(`Candidat ${c.id} : primaire inconnue « ${c.primary} »`);
  }
  const declIds = new Set<string>();
  const filesSeen = new Set<string>();
  for (const f of d.declarationFiles) {
    if (!candidateIds.has(f.candidateId)) errors.push(`Fichier de déclarations pour un candidat inconnu : ${f.candidateId}`);
    if (filesSeen.has(f.candidateId)) errors.push(`Deux fichiers de déclarations pour ${f.candidateId}`);
    filesSeen.add(f.candidateId);
    for (const decl of f.declarations) {
      if (declIds.has(decl.id)) errors.push(`Déclaration dupliquée : ${decl.id}`);
      declIds.add(decl.id);
      if (!decl.id.startsWith(f.candidateId.split('-')[0])) {
        // soft convention, not an error: declaration ids should start with the candidate id
      }
      if (decl.review.status === 'verified' && decl.review.reviewers.length < 2) {
        errors.push(`Déclaration ${decl.id} : une déclaration « verified » exige au moins deux relecteurs`);
      }
      if (decl.review.status === 'verified' && !decl.review.reviewedOn) {
        errors.push(`Déclaration ${decl.id} : date de relecture manquante`);
      }
      if (decl.sourceType === 'presse' && decl.positions.length > 0) {
        errors.push(`Déclaration ${decl.id} : un article de presse ne peut pas porter de position (source primaire exigée : programme, discours, communiqué, vote, tribune, entretien)`);
      }
      const seen = new Set<string>();
      for (const p of decl.positions) {
        if (!p.quote) errors.push(`Déclaration ${decl.id} : la position ${p.questionId} n'a pas de citation (« quote ») extraite de la source`);
        if (!questionIds.has(p.questionId)) errors.push(`Déclaration ${decl.id} : question inconnue « ${p.questionId} »`);
        if (seen.has(p.questionId)) errors.push(`Déclaration ${decl.id} : question ${p.questionId} renseignée deux fois`);
        seen.add(p.questionId);
      }
    }
  }
  for (const id of candidateIds) {
    if (!filesSeen.has(id)) errors.push(`Candidat ${id} : fichier data/declarations/${id}.json manquant (il peut être vide)`);
  }
  return errors;
}

export function loadRawData(): RawData {
  const topics = parse(z.array(TopicSchema), readJson(join(DATA_DIR, 'topics.json')), 'data/topics.json');
  const questions = parse(z.array(QuestionSchema), readJson(join(DATA_DIR, 'questions.json')), 'data/questions.json');
  const candidatesFile = parse(CandidatesFileSchema, readJson(join(DATA_DIR, 'candidates.json')), 'data/candidates.json');
  const declDir = join(DATA_DIR, 'declarations');
  const declarationFiles = readdirSync(declDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const parsed = parse(DeclarationsFileSchema, readJson(join(declDir, f)), `data/declarations/${f}`);
      if (`${parsed.candidateId}.json` !== f) throw new DataError(`data/declarations/${f} : candidateId « ${parsed.candidateId} » ne correspond pas au nom du fichier`);
      return parsed;
    });
  const data = { topics, questions, candidatesFile, declarationFiles };
  const errors = checkConsistency(data);
  if (errors.length) throw new DataError(`Incohérences dans les données :\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  return data;
}
