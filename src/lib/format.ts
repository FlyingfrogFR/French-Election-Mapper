const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.length === 10 ? `${iso}T00:00:00Z` : iso}`);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(`${iso.length === 10 ? `${iso}T00:00:00Z` : iso}`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

/** ISO-8601 week label, e.g. "2026-S38", used to group weekly updates. */
export function isoWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}

export const REPO_URL = import.meta.env.VITE_REPO_URL?.trim() || 'https://github.com/FlyingfrogFR/French-Election-Mapper';
export const OPERATOR_NAME = import.meta.env.VITE_OPERATOR_NAME?.trim() || '[Nom du responsable de traitement à renseigner]';
export const OPERATOR_CONTACT = import.meta.env.VITE_OPERATOR_CONTACT?.trim() || '[adresse de contact à renseigner]';
