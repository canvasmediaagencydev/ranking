import type { PickType } from '@/lib/pulse-engine';

// Per-photo achievement history ("provenance") + the curated/archive split for
// the museum-style portfolio. Pure logic — no React, no Supabase. Everything is
// derived from columns that already exist (pick_type, badge, peak_pulse) plus a
// season_winners lookup; nothing here depends on the spec's not-yet-built
// weekly_top3 / peak_goscore / tier objects.

export interface ProvenanceBadge {
  label: string;
  // 'gold' = brand status accent, 'ink' = neutral hairline chip
  tone: 'gold' | 'ink';
}

export interface SeasonAward {
  seasonName: string;
  category: string;
}

// Superset of a mapped Supabase photo row used for curation + specimen labels.
export interface CollectionPhoto {
  id: string;
  src: string;
  title: string;
  cat: string;
  w: number;
  h: number;
  pulse: number;
  peakPulse?: number | null;
  pickType?: PickType;
  badge?: string | null;
  location?: string;
  camera?: string;
  lens?: string;
  year?: string;
  exifSettings?: string;
  date?: string;
}

const BADGE_LABELS: Record<string, string> = {
  legendary: 'Legendary',
  hall_of_fame: 'Hall of Fame',
  top_field: 'Top of the Field',
  daily_winner: 'Daily Winner',
};

export function getPhotoProvenance(
  photo: CollectionPhoto,
  awards: Map<string, SeasonAward>,
): ProvenanceBadge[] {
  const out: ProvenanceBadge[] = [];
  const award = awards.get(photo.id);
  if (award) out.push({ label: `★ ${award.seasonName.toUpperCase()} · WINNER`, tone: 'gold' });

  const pt = photo.pickType ?? 'none';
  if (pt === 'ambassador' || pt === 'both') out.push({ label: "Ambassador's Pick", tone: 'gold' });
  if (pt === 'editor' || pt === 'both') out.push({ label: "Editor's Pick", tone: 'ink' });

  const badgeLabel = photo.badge ? BADGE_LABELS[photo.badge] : undefined;
  if (badgeLabel) out.push({ label: badgeLabel, tone: 'ink' });

  return out;
}

// Higher score = more collection-worthy. Provenance dominates; pulse breaks ties.
function curationScore(photo: CollectionPhoto, awards: Map<string, SeasonAward>): number {
  let s = photo.peakPulse ?? photo.pulse ?? 0;
  if (awards.has(photo.id)) s += 1000;
  const pt = photo.pickType ?? 'none';
  if (pt === 'ambassador' || pt === 'both') s += 400;
  if (pt === 'editor' || pt === 'both') s += 300;
  if (photo.badge && photo.badge in BADGE_LABELS) s += 150;
  return s;
}

export const MAX_CURATED = 12;

// Owner pinning lands later (photos.is_curated). Until then we auto-derive the
// 12 most collection-worthy frames; the rest fall into the archive drawer.
export function selectCuration<T extends CollectionPhoto>(
  photos: T[],
  awards: Map<string, SeasonAward>,
): { curated: T[]; archive: T[] } {
  const ranked = [...photos].sort((a, b) => curationScore(b, awards) - curationScore(a, awards));
  return { curated: ranked.slice(0, MAX_CURATED), archive: ranked.slice(MAX_CURATED) };
}

// "ดอยแม่สลอง · 2025 — Sony A7R V · 16-35mm · f/8 · ISO 100"
export function formatSpecimenMeta(photo: CollectionPhoto): string {
  const place = photo.location && photo.location !== 'EARTH' ? photo.location : '';
  const head = [place, photo.year].filter(Boolean).join(' · ');
  const gear = [photo.camera, photo.lens].filter((g) => g && g !== 'Unknown').join(' · ');
  const tail = [gear, photo.exifSettings].filter(Boolean).join(' · ');
  return [head, tail].filter(Boolean).join(' — ');
}

// "001" running specimen number.
export function specimenNo(index: number): string {
  return String(index + 1).padStart(3, '0');
}
