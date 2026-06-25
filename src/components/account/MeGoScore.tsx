'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// GoScore transparency panel for the owner's featured photo. Shows ONLY what the
// live Pulse V4 system actually tracks: total votes, first-24h (full-weight)
// votes, and the voter-role mix (Ambassador / Traveller / General). The exact
// per-role weights + anti-gaming are intentionally hidden — so the numbers stay
// truthful without exposing the formula. (The spec's "curation bonus" and
// "time decay" rows were dropped: V4 removed both.)

const BADGE_TIER: Record<string, string> = {
  legendary: '★ Legendary',
  popular: '★ Popular',
  trending: '★ Trending',
  hidden_gem: '★ Hidden Gem',
  daily_winner: '★ Daily Winner',
  hall_of_fame: '★ Hall of Fame',
};

interface Breakdown { total: number; first24h: number; amb: number; trav: number; gen: number; }

interface MeGoScoreProps { myPhotos: any[]; }

export function MeGoScore({ myPhotos }: MeGoScoreProps) {
  const t = useTranslations('MePage');
  const router = useRouter();
  const featured = myPhotos.length
    ? [...myPhotos].sort((a, b) => (b.peakPulse ?? b.pulse ?? 0) - (a.peakPulse ?? a.pulse ?? 0))[0]
    : null;
  const [bd, setBd] = useState<Breakdown | null>(null);

  useEffect(() => {
    if (!featured?.id) return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('votes')
        .select('voted_at, users ( is_ambassador, is_customer, photographer_status )')
        .eq('photo_id', featured.id);
      if (cancelled) return;
      const rows = (data || []) as any[];
      const uploaded = featured.date ? new Date(featured.date).getTime() : 0;
      const cutoff = uploaded + 24 * 3600 * 1000;
      let first24h = 0, amb = 0, trav = 0, gen = 0;
      for (const r of rows) {
        const u = r.users || {};
        const isAmb = !!u.is_ambassador || u.photographer_status === 'approved';
        const isTrav = !isAmb && !!u.is_customer;
        if (isAmb) amb++; else if (isTrav) trav++; else gen++;
        if (uploaded && r.voted_at && new Date(r.voted_at).getTime() <= cutoff) first24h++;
      }
      setBd({ total: rows.length, first24h, amb, trav, gen });
    })();
    return () => { cancelled = true; };
  }, [featured?.id, featured?.date]);

  if (!featured) return null;

  const score = Math.round(featured.pulse ?? 0);
  const tier = featured.badge ? BADGE_TIER[featured.badge] : undefined;
  const mix = bd
    ? [
        { label: 'Ambassador', n: bd.amb },
        { label: 'Traveller', n: bd.trav },
        { label: t('voter_general'), n: bd.gen },
      ]
    : [];

  return (
    <section className="mt-12">
      <div className="border-b border-rule pb-[14px] mb-5">
        <h2 className="font-serif text-[20px] md:text-[21px] font-semibold">
          <span className="mono text-gold text-[10px] tracking-[.3em] mr-[10px]">— 02</span>
          {t('goscore_featured', { title: featured.title || '' })}
        </h2>
      </div>
      <div className="border border-rule bg-cream grid grid-cols-1 md:grid-cols-[170px_1fr] gap-7 md:gap-[28px] items-center p-6">
        <button onClick={() => router.push(`/photo/${featured.id}`)} className="text-center bg-transparent border-0 cursor-pointer p-0">
          <div className="font-serif text-[48px] md:text-[54px] font-semibold leading-none">{score}</div>
          <div className="mono text-[9px] tracking-[.2em] uppercase text-fg-soft mt-1">{t('current_goscore')}</div>
          {tier && <div className="mono text-[9px] tracking-[.14em] uppercase text-gold border border-gold inline-block px-[10px] py-[5px] mt-[11px]">{tier}</div>}
        </button>

        <div>
          {!bd ? (
            <div className="mono text-[11px] text-fg-faint">…</div>
          ) : bd.total === 0 ? (
            <div className="mono text-[12px] text-fg-soft th">{t('no_votes_yet')}</div>
          ) : (
            <>
              <div className="flex flex-col gap-[11px]">
                <GoRow label={t('total_votes')} val={bd.total} pct={100} />
                <GoRow label={t('votes_first_24h')} val={bd.first24h} pct={Math.round((bd.first24h / bd.total) * 100)} />
              </div>
              <div className="mono text-[10px] tracking-[.1em] uppercase text-fg-soft mt-5 mb-2">{t('voter_mix')}</div>
              <div className="flex flex-col gap-[8px]">
                {mix.map((m) => {
                  const p = Math.round((m.n / bd.total) * 100);
                  return (
                    <div key={m.label} className="flex items-center text-[12px]">
                      <span className="w-[110px] text-fg-soft mono text-[11px]">{m.label}</span>
                      <span className="flex-1 h-[6px] bg-rule overflow-hidden">
                        <span className="block h-full bg-fg" style={{ width: `${p}%` }} />
                      </span>
                      <span className="w-[44px] text-right mono tabular-nums">{p}%</span>
                    </div>
                  );
                })}
              </div>
              <p className="mono text-[10px] text-fg-faint mt-4 leading-[1.6] th">{t('weights_hidden')}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function GoRow({ label, val, pct }: { label: string; val: number; pct: number }) {
  return (
    <div className="flex items-center text-[12px]">
      <span className="w-[180px] md:w-[200px] text-fg-soft th">{label}</span>
      <span className="flex-1 h-[6px] bg-rule overflow-hidden">
        <span className="block h-full bg-fg" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </span>
      <span className="w-[56px] text-right mono tabular-nums">{val}</span>
    </div>
  );
}
