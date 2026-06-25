// @ts-nocheck
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { pulseScore } from '@/lib/data';
import { formatScore } from '@/lib/pulse';
import { useApp } from '@/providers/AppProvider';
import { VoteAspect } from '@/components/photo/VoteAspect';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileNav, MobileFooter, MobileMarquee, MobileSectionHeader, BottomNav } from './MobileShared';
import { CrownIcon } from '@/components/icons';
import { PulseStatusBadge } from '@/components/photo/PulseStatusBadge';
import { SHOW_LIKE_COUNTS } from '@/lib/flags';

// Masonry photo tile with avatar+username overlay (left) and like button (right)
export function MasonryTile({ photo }: { photo: any }) {
  const router = useRouter();
  const { authUser } = useApp();
  const aspect = photo.w && photo.h ? `${photo.w} / ${photo.h}` : '4 / 5';

  const avatarUrl = photo.avatarUrl || photo.photographerAvatar;

  return (
    <div
      onClick={() => router.push(`/photo/${photo.slug || photo.id}`)}
      style={{
        position: 'relative', breakInside: 'avoid',
        marginBottom: 8, cursor: 'pointer', overflow: 'hidden', background: 'var(--tile)',
      }}
    >
      <div style={{ width: '100%', aspectRatio: aspect, overflow: 'hidden' }}>
        <img
          src={photo.src}
          alt={photo.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
      </div>
      {/* Badges — absolute top-left */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10,
        alignItems: 'flex-start'
      }}>
        {photo.voyageurOnly && (
          <div style={{
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            color: '#b08e54', border: '1px solid rgba(176,142,84,0.3)',
            fontSize: 8, letterSpacing: '0.12em', fontWeight: 600,
            textTransform: 'uppercase', padding: '3px 6px', borderRadius: 2,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>👑</span>
            <span>Traveller Only</span>
          </div>
        )}
        <PulseStatusBadge pulse={photo.peakPulse ?? photo.pulse} pickType={photo.pickType || 'none'} />
      </div>
      {/* Bottom gradient for legibility */}
      <div style={{
        position: 'absolute', inset: 'auto 0 0 0', height: 56,
        background: 'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.25), transparent)',
        pointerEvents: 'none',
      }} />
      {/* Avatar + username — bottom-left */}
      <div style={{
        position: 'absolute', left: 10, bottom: 10,
        display: 'flex', alignItems: 'center', gap: 7,
        maxWidth: 'calc(100% - 70px)',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          overflow: 'hidden', background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0,
        }}>
          {avatarUrl && (
            <img src={avatarUrl} alt={photo.by} style={{
              width: '100%', height: '100%', objectFit: 'cover',
            }} />
          )}
        </div>
        <span style={{
          color: '#fff', fontSize: 13, fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}>{photo.by}</span>
      </div>
      {/* Vote aspect — replaces the like (color / composition) */}
      <VoteAspect photoId={photo.id} ownerId={(photo as any).photographerId ?? (photo as any).ownerId ?? null} variant="card" />
    </div>
  );
}

const CATS = ['All', 'Travellers', 'Landscape', 'Portrait', 'BW'] as const;

export function MobileExplore({ initialCategory = 'All', dbPhotos = [] }: { initialCategory?: typeof CATS[number], dbPhotos?: any[] }) {
  const router = useRouter();
  const { theme } = useApp();
  const dark = theme === 'dark';
  const [sort, setSort] = useState<'Hirest' | 'Fresh'>('Fresh');
  const [cat, setCat] = useState<typeof CATS[number]>(initialCategory);
  const [visible, setVisible] = useState(8);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 800) {
        setVisible(v => v + 8);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const dataSource = dbPhotos;

  const filtered = useMemo(() => {
    const base = cat === 'All' ? dataSource
      : cat === 'Travellers' ? dataSource.filter(p => p.isVoyageur)
      : dataSource.filter(p => p.cat === cat || p.cat.toLowerCase() === cat.toLowerCase());
    return sort === 'Hirest'
      ? base.slice().sort((a, b) => (b.pulse !== undefined ? b.pulse : pulseScore(b)) - (a.pulse !== undefined ? a.pulse : pulseScore(a)))
      : base.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sort, cat, dataSource]);
  const grid = filtered.slice(0, visible);

  const trending = useMemo(() => {
    // 1. Group photos by week key (Monday of the week)
    const getWeekKey = (dateStr: string) => {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'unknown';
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
      const monday = new Date(date.setDate(diff));
      return monday.toISOString().split('T')[0];
    };

    const photosByWeek: Record<string, typeof dataSource> = {};
    dataSource.forEach(p => {
      if (!p.date) return;
      const wk = getWeekKey(p.date);
      if (!photosByWeek[wk]) photosByWeek[wk] = [];
      photosByWeek[wk].push(p);
    });

    // 2. Compute rankings per week
    const weekRankings: Record<string, { username: string, totalScore: number }[]> = {};
    Object.entries(photosByWeek).forEach(([wk, weekPhotos]) => {
      const scoresByPhotographer: Record<string, number> = {};
      weekPhotos.forEach(p => {
        const score = p.pulse && p.pulse > 0 ? p.pulse : pulseScore(p);
        scoresByPhotographer[p.by] = (scoresByPhotographer[p.by] || 0) + score;
      });
      const sorted = Object.entries(scoresByPhotographer)
        .map(([username, totalScore]) => ({ username, totalScore }))
        .sort((a, b) => b.totalScore - a.totalScore);
      weekRankings[wk] = sorted;
    });

    // 3. Find Rank Masters (top 3 for 3 consecutive weeks)
    const sortedWeeks = Object.keys(photosByWeek).sort();
    const rankMasterUsernames = new Set<string>();
    const allUsernames = Array.from(new Set(dataSource.map(p => p.by)));

    if (sortedWeeks.length > 0) {
      const minDate = new Date(sortedWeeks[0]);
      const maxDate = new Date(sortedWeeks[sortedWeeks.length - 1]);
      const allWeeks: string[] = [];
      let curr = new Date(minDate);
      while (curr <= maxDate) {
        allWeeks.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 7);
      }

      allUsernames.forEach(username => {
        let streak = 0;
        for (const wk of allWeeks) {
          const rankings = weekRankings[wk] || [];
          const rankIndex = rankings.findIndex(r => r.username === username);
          const rankedTop3 = rankIndex !== -1 && rankIndex < 3;
          if (rankedTop3) {
            streak += 1;
            if (streak >= 3) {
              rankMasterUsernames.add(username);
            }
          } else {
            streak = 0;
          }
        }
      });
    }

    // 4. Find Top 10 Trending Photographers for the latest week
    const latestWeek = sortedWeeks[sortedWeeks.length - 1];
    const latestRankings = weekRankings[latestWeek] || [];
    
    // In case there's no latest week or no rankings, fallback to overall top photographers
    if (latestRankings.length === 0) {
      const byUser: Record<string, { name: string, avatar: string, pulse: number }> = {};
      dataSource.forEach(ph => {
        const score = ph.pulse && ph.pulse > 0 ? ph.pulse : pulseScore(ph);
        const entry = byUser[ph.by] || { name: ph.photographerName || ph.by, avatar: ph.photographerAvatar || ph.avatarUrl || '', pulse: 0 };
        entry.pulse += score;
        byUser[ph.by] = entry;
      });
      return Object.entries(byUser)
        .map(([username, e]) => ({ username, ...e, isRankMaster: false }))
        .sort((a, b) => b.pulse - a.pulse)
        .slice(0, 10);
    }

    return latestRankings.slice(0, 10).map(r => {
      const matchedPhoto = dataSource.find(ph => ph.by === r.username);

      return {
        username: r.username,
        name: matchedPhoto?.photographerName || r.username,
        avatar: matchedPhoto?.photographerAvatar || matchedPhoto?.avatarUrl || '',
        pulse: r.totalScore,
        isRankMaster: rankMasterUsernames.has(r.username)
      };
    });
  }, [dataSource]);

  return (
    <div className="gpa-mobile" style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: dark ? '#0a0a0a' : '#fff',
      color: dark ? '#fff' : '#000',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <MobileNav />

      {/* Tight cover */}
      <div style={{ padding: '32px 16px 0' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
          letterSpacing: '0.18em', color: 'var(--fg-soft)',
        }}>— Explore</div>
        <h1 style={{
          margin: '8px 0 14px',
          fontFamily: "'Playfair Display', serif", fontWeight: 700,
          fontSize: 36, lineHeight: 1.02, letterSpacing: '-0.02em',
        }}>This season's frames</h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--fg-soft)', margin: 0, maxWidth: '36ch' }}>
          {filtered.length} of {dataSource.length} frames. Updated continuously.
        </p>
      </div>

      {/* Sort — segmented control */}
      <div style={{ padding: '26px 16px 0' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          opacity: 0.4, marginBottom: 11,
        }}>Sort by</div>
        <div style={{ display: 'flex', height: 46, border: '1px solid var(--rule-strong)' }}>
          {([
            { k: 'Hirest', label: 'Top Pulse' },
            { k: 'Fresh',  label: 'Newest' },
          ] as const).map((s, i) => {
            const active = sort === s.k;
            return (
              <button key={s.k} onClick={() => setSort(s.k)} style={{
                flex: 1, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? (dark ? '#fff' : '#000') : 'transparent',
                color: active ? (dark ? '#000' : '#fff') : (dark ? '#fff' : '#000'),
                border: 0, borderRight: i === 0 ? '1px solid var(--rule-strong)' : 0,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500,
                transition: 'background .15s ease, color .15s ease',
              }}>{s.label}</button>
            );
          })}
        </div>
      </div>

      {/* Category — label + horizontal scroll chips */}
      <div style={{ padding: '22px 16px 0' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          opacity: 0.4, marginBottom: 11,
        }}>Category</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px' }}>
        {CATS.map(c => {
          const active = cat === c;
          const gold = c === 'Travellers';
          const border = gold ? '#b08e54' : active ? (dark ? '#fff' : '#000') : 'var(--rule)';
          const background = gold
            ? '#b08e54'
            : (active ? (dark ? '#fff' : '#000') : 'transparent');
          const color = gold
            ? '#1a1305'
            : (active ? (dark ? '#000' : '#fff') : (dark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)'));
          return (
            <button key={c} onClick={() => {
              setCat(c);
              router.push(c === 'All' ? '/explore' : `/explore/${c.toLowerCase()}`);
            }} style={{
              height: 38, padding: '0 16px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              border: `1px solid ${border}`,
              background,
              color,
              boxShadow: gold && active ? 'inset 0 0 0 1.5px #1a1305' : 'none',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontWeight: gold ? 600 : 400,
              transition: 'background .15s ease, color .15s ease, border-color .15s ease, box-shadow .15s ease',
            }}>
              {gold && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3 7l4.5 3L12 4l4.5 6L21 7l-1.6 11H4.6L3 7z" />
                </svg>
              )}
              {c === 'BW' ? 'B&W' : c}
            </button>
          );
        })}
      </div>

      {/* Photo grid — 2-col masonry (Pinterest-style) */}
      <div style={{ padding: '16px 6px 0' }}>
        <div style={{
          columnCount: 2,
          columnGap: 8,
        }}>
          {grid.map(p => (
            <MasonryTile key={p.id} photo={p} />
          ))}
        </div>
        {visible < filtered.length && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fg-soft)', fontSize: 13 }}>
            Loading more...
          </div>
        )}
      </div>

      {/* Trending — moved below grid */}
      <section style={{ padding: '56px 0 0', background: dark ? '#131310' : 'var(--cream)' }}>
        <div style={{ padding: '32px 16px 0' }}>
          <MobileSectionHeader num="—" title="Trending photographers" link="All" href="/photographers" />
        </div>
        <div style={{ marginTop: 18, padding: '0 0 32px', overflow: 'hidden' }}>
          {/* ponytail: only loop/duplicate when there are enough cards to scroll; else a single static row so few photographers don't repeat side-by-side */}
          <div style={{ display: 'flex', width: 'max-content', animation: trending.length > 3 ? 'trendingSlide 80s linear infinite' : 'none' }}>
            {(trending.length > 3 ? [0, 1] : [0]).map(group => (
              <div key={group} aria-hidden={group === 1} style={{ display: 'flex', gap: 16, paddingLeft: 16, paddingRight: 0 }}>
                {trending.map(p => (
                  <div
                    key={`${group}-${p.username}`}
                    onClick={() => router.push(`/photographer/${p.username}`)}
                    style={{ width: 140, flex: '0 0 140px', cursor: 'pointer' }}
                  >
                    <div style={{ aspectRatio: '1', background: 'var(--tile)', overflow: 'hidden', position: 'relative' }}>
                      {p.avatar && <img src={p.avatar} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
                      {p.isRankMaster && (
                        <div style={{
                          position: 'absolute', top: 6, right: 6,
                          background: '#c0c0c0', color: '#1a1a1a',
                          borderRadius: '50%', width: 22, height: 22,
                          display: 'grid', placeItems: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          zIndex: 2
                        }} title="Rank Master">
                          <CrownIcon />
                        </div>
                      )}
                    </div>
                    <div style={{
                      marginTop: 10, fontSize: 13, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 4
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      {p.isRankMaster && (
                        <span style={{ color: '#c0c0c0', flexShrink: 0 }} title="Rank Master">
                          <CrownIcon />
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                      letterSpacing: '0.08em', color: 'var(--fg-soft)',
                      marginTop: 2, textTransform: 'uppercase',
                    }}>Pulse {typeof p.pulse === 'number' ? formatScore(p.pulse) : p.pulse}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <MobileMarquee text={`◆ ${dataSource.length} frames ◆ Season 01 ◆ Updated continuously ◆`} />
      <MobileFooter />
    </div>
  );
}
