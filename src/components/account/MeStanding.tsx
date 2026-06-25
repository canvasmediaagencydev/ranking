'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// "Your standing" — the owner's rank per category (+ overall), computed from the
// real pool of published photos. Each photographer is represented by their best
// peak_pulse in the category; rank = how many photographers score higher + 1.

const CAT_LABELS: Record<string, string> = {
  landscape: 'Landscape',
  portrait: 'Portrait',
  bw: 'Black & White',
};

interface StandingCard {
  key: string;
  label: string;
  rank: number;
  total: number;
  gap: number;
  isOverall: boolean;
}

interface MeStandingProps {
  userId?: string;
  myPhotos: any[];
}

export function MeStanding({ userId, myPhotos }: MeStandingProps) {
  const t = useTranslations('MePage');
  const router = useRouter();
  const [cards, setCards] = useState<StandingCard[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('photos')
        .select('photographer_id, category, peak_pulse, pulse')
        .eq('status', 'published')
        .eq('is_hidden', false);
      if (cancelled) return;

      const photos = (data || []).map((p: any) => ({
        photographer_id: p.photographer_id as string,
        category: p.category as string,
        peak: p.peak_pulse != null ? Number(p.peak_pulse) : p.pulse != null ? Number(p.pulse) : 0,
      }));

      const bestMap = (cat?: string) => {
        const m = new Map<string, number>();
        for (const p of photos) {
          if (cat && p.category !== cat) continue;
          m.set(p.photographer_id, Math.max(m.get(p.photographer_id) ?? 0, p.peak));
        }
        return m;
      };
      const rankOf = (m: Map<string, number>) => {
        const mine = m.get(userId);
        if (mine == null) return null;
        const values = Array.from(m.values());
        const higher = values.filter((v) => v > mine);
        const gap = higher.length ? Math.min(...higher) - mine : 0;
        return { rank: higher.length + 1, total: values.length, gap };
      };

      const myCats = Array.from(new Set(myPhotos.map((p: any) => p.cat).filter(Boolean)));
      const catCards: StandingCard[] = [];
      for (const cat of myCats) {
        const r = rankOf(bestMap(cat));
        if (r) catCards.push({ key: cat, label: CAT_LABELS[cat] ?? cat, rank: r.rank, total: r.total, gap: r.gap, isOverall: false });
      }
      catCards.sort((a, b) => a.rank - b.rank);

      const out: StandingCard[] = catCards.slice(0, 2);
      const overall = rankOf(bestMap());
      if (overall) out.push({ key: 'overall', label: t('cat_overall'), rank: overall.rank, total: overall.total, gap: overall.gap, isOverall: true });
      setCards(out);
    })();
    return () => { cancelled = true; };
  }, [userId, myPhotos, t]);

  if (!cards || cards.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between border-b border-rule pb-[14px] mb-5">
        <h2 className="font-serif text-[20px] md:text-[21px] font-semibold">
          <span className="mono text-gold text-[10px] tracking-[.3em] mr-[10px]">— 01</span>{t('your_standing')}
        </h2>
        <button onClick={() => router.push('/hall-of-fame')} className="caps text-[10px] opacity-65 hover:opacity-100 transition-opacity bg-transparent border-0 cursor-pointer">
          {t('full_leaderboard')} →
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const pct = c.total > 0 ? Math.max(6, Math.round(((c.total - c.rank + 1) / c.total) * 100)) : 6;
          const togo = c.rank === 1
            ? t('standing_top')
            : c.isOverall && c.rank <= 3
              ? t('standing_keep_master')
              : t('standing_overtake', { pts: c.gap.toFixed(1), rank: c.rank - 1 });
          return (
            <div key={c.key} className="border border-rule bg-cream p-[18px]">
              <div className="mono text-[9.5px] tracking-[.18em] uppercase text-fg-soft">{c.label}</div>
              <div className="font-serif text-[28px] md:text-[30px] font-semibold mt-[6px]">
                {t('rank_word')} <span className="text-gold">#{c.rank}</span>
              </div>
              <div className="h-[3px] bg-rule mt-[14px] overflow-hidden">
                <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
              </div>
              <div className="mono text-[10px] text-fg-soft mt-[9px] th">{togo}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
