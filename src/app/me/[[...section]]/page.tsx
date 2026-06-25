'use client';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/providers/AppProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { PageCover } from '@/components/layout/PageCover';
import { useCoverReposition } from '@/hooks/useCoverReposition';
import { Footer } from '@/components/layout/Footer';
import { MeSidebar } from '@/components/account/MeSidebar';
import { MeSidebarSkeleton, MeContentSkeleton } from '@/components/account/MeSkeleton';
import { MeDashboard } from '@/components/account/MeDashboard';
import { MePhotos } from '@/components/account/MePhotos';
import { MeFavorites } from '@/components/account/MeFavorites';
import { MeStats } from '@/components/account/MeStats';
import { MeSettings } from '@/components/account/MeSettings';
import { MeNotifications } from '@/components/account/MeNotifications';
import { MobileMe } from '@/components/mobile/MobileMe';
import { useTranslations } from 'next-intl';
import type { Photographer } from '@/lib/types';
import { getSeasons } from '@/lib/data';
import { computePulse, type PickType } from '@/lib/pulse-engine';

function daysUntil(dateStr: string): number {
  const end = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

interface PageProps {
  params: { section?: string[] };
}

function mapPhoto(p: any, username: string, fallbackEmail?: string) {
  const likes = p.likes_count || 0;
  const favorites = p.favorites_count || 0;
  const comments = p.comments_count || 0;
  return {
    id: p.id,
    slug: p.id,
    title: p.title,
    by: username || fallbackEmail?.split('@')[0] || 'Unknown',
    cat: p.category,
    w: p.width || 4,
    h: p.height || 3,
    src: p.storage_url,
    caption: p.caption || '',
    exif: { camera: 'Unknown', lens: 'Unknown', iso: 100, shutter: '1/100', aperture: 'f/8', focal: '50mm' },
    likes,
    likes24h: 0,
    comments,
    favorites,
    hours: 1,
    picks: [],
    date: p.uploaded_at,
    pulse: p.pulse != null ? Number(p.pulse) : 0,
    peakPulse: p.peak_pulse != null ? Number(p.peak_pulse) : null,
    badge: p.badge ?? null,
    impressions: p.impressions_count || 0,
    visibility: p.visibility ?? 'public',
    rank: 0,
  };
}

export default function Page({ params }: PageProps) {
  const { authUser } = useApp();
  const t = useTranslations('MePage');
  const [section, setSection] = useState<string>(params.section?.[0] ?? 'dashboard');

  const navigateSection = useCallback((id: string, path: string) => {
    setSection(id);
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  const [uploadingCover, setUploadingCover] = useState(false);
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser?.id) {
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB');
      e.target.value = '';
      return;
    }

    setUploadingCover(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `covers/${authUser.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from('photos').getPublicUrl(fileName);
      const publicUrl = pub.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ cover_url: publicUrl })
        .eq('id', authUser.id);
      if (updateError) throw updateError;

      setProfile((p: any) => ({ ...p, cover_url: publicUrl }));
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path === '/me' || path === '/me/') {
        setSection('dashboard');
        return;
      }
      const seg = path.replace(/^\/me\/?/, '').split('/')[0];
      if (seg) setSection(seg);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [profile, setProfile] = useState<any>(null);
  const [myPhotos, setMyPhotos] = useState<any[]>([]);
  const [favs, setFavs] = useState<any[]>([]);
  const [favDates, setFavDates] = useState<string[]>([]);
  const [favIsPublic, setFavIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voyageurRank, setVoyageurRank] = useState<number | null>(null);
  const [topCategory, setTopCategory] = useState<string | null>(null);

  const saveCoverPosition = useCallback(async (pos: string) => {
    if (!authUser?.id) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('users')
      .update({ cover_position: pos })
      .eq('id', authUser.id);
    if (error) {
      alert('Save failed: ' + error.message);
      return;
    }
    setProfile((p: any) => ({ ...p, cover_position: pos }));
  }, [authUser]);
  const cover = useCoverReposition(profile?.cover_position, saveCoverPosition);

  const liveSeason = getSeasons().find(s => s.status === 'live');
  const daysLeft = liveSeason?.endDate ? daysUntil(liveSeason.endDate) : null;

  const fetchPhotos = async (profileUsername: string) => {
    if (!authUser?.id) return;
    const supabase = getSupabaseBrowserClient();
    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .eq('photographer_id', authUser.id)
      .order('uploaded_at', { ascending: false });
    setMyPhotos((photos || []).map((p: any) => mapPhoto(p, profileUsername, authUser?.email)));
  };

  const handlePhotoDeleted = useCallback((id: string) => {
    setMyPhotos((curr) => curr.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    if (!authUser?.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const supabase = getSupabaseBrowserClient();

      const [profRes, photosRes, favsRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
        supabase.from('photos').select('*').eq('photographer_id', authUser.id).order('uploaded_at', { ascending: false }),
        supabase
          .from('favorites')
          .select(`photo_id, favorited_at, photos (*, users!photographer_id(username))`)
          .eq('user_id', authUser.id)
          .order('favorited_at', { ascending: false }),
      ]);

      const prof = profRes.data || {
        username: authUser.email?.split('@')[0],
        display_name: authUser.email?.split('@')[0],
        avatar_url: authUser.user_metadata?.avatar_url || '',
      };
      setProfile(prof);

      const username = prof?.username || '';
      setMyPhotos((photosRes.data || []).map((p: any) => mapPhoto(p, username, authUser?.email)));

      // Compute Voyageur rank from real photo data
      if (prof?.is_customer) {
        const userPhotos = photosRes.data || [];
        if (userPhotos.length > 0) {
          const catCounts: Record<string, number> = {};
          const catBestLikes: Record<string, number> = {};
          for (const p of userPhotos) {
            const cat = p.category as string;
            if (!cat) continue;
            catCounts[cat] = (catCounts[cat] || 0) + 1;
            catBestLikes[cat] = Math.max(catBestLikes[cat] || 0, p.likes_count || 0);
          }
          const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
          if (topCat) {
            setTopCategory(topCat);
            const bestLikes = catBestLikes[topCat] || 0;
            const { data: vUsers } = await supabase
              .from('users').select('id').eq('is_customer', true).neq('id', authUser.id);
            const vIds = (vUsers || []).map((u: any) => u.id as string);
            if (vIds.length > 0) {
              const { count } = await supabase
                .from('photos')
                .select('id', { count: 'exact', head: true })
                .eq('category', topCat)
                .gt('likes_count', bestLikes)
                .in('photographer_id', vIds);
              setVoyageurRank((count ?? 0) + 1);
            } else {
              setVoyageurRank(1);
            }
          }
        }
      }

      const favPhotos = (favsRes.data || [])
        .map((row: any) => row.photos)
        .filter(Boolean)
        .map((p: any) => mapPhoto(p, p?.users?.username || ''));
      setFavs(favPhotos);
      setFavDates((favsRes.data || []).map((row: any) => row.favorited_at).filter(Boolean));
      setFavIsPublic(prof?.favorites_visibility === 'public');

      setLoading(false);
    };

    fetchData();
  }, [authUser]);

  // Realtime: patch own profile counts (followers / following) when the
  // users row UPDATEs.
  useEffect(() => {
    if (!authUser?.id) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`me-user-${authUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${authUser.id}` },
        (payload) => {
          const next = payload.new as { followers_count?: number; following_count?: number };
          setProfile((curr: any) => curr ? {
            ...curr,
            followers_count: typeof next.followers_count === 'number' ? next.followers_count : curr.followers_count,
            following_count: typeof next.following_count === 'number' ? next.following_count : curr.following_count,
          } : curr);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser?.id]);

  // Realtime: keep /me/favorites in sync when the user favorites or
  // unfavorites a photo from anywhere (photo detail page, another tab).
  useEffect(() => {
    if (!authUser?.id) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`me-favorites-${authUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'favorites', filter: `user_id=eq.${authUser.id}` },
        async (payload) => {
          const row = payload.new as { photo_id: string };
          const { data: photo } = await supabase
            .from('photos')
            .select('*, users!photographer_id(username)')
            .eq('id', row.photo_id)
            .maybeSingle();
          if (!photo) return;
          const mapped = mapPhoto(photo, (photo as any)?.users?.username || '');
          setFavs((curr) => {
            if (curr.some((p: any) => p?.id === mapped.id)) return curr;
            return [mapped, ...curr];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'favorites', filter: `user_id=eq.${authUser.id}` },
        (payload) => {
          const removed = payload.old as { photo_id?: string };
          if (!removed?.photo_id) return;
          setFavs((curr) => curr.filter((p: any) => p?.id !== removed.photo_id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser?.id]);

  // Realtime: patch likes / favorites / comments counts on the user's own
  // photos so the Dashboard stats and Pulse recompute as votes come in.
  useEffect(() => {
    if (!authUser?.id) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`me-photos-${authUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'photos', filter: `photographer_id=eq.${authUser.id}` },
        (payload) => {
          const next = payload.new as {
            id: string;
            likes_count?: number;
            favorites_count?: number;
            comments_count?: number;
          };
          setMyPhotos((curr) =>
            curr.map((p) => {
              if (p.id !== next.id) return p;
              const likes = typeof next.likes_count === 'number' ? next.likes_count : p.likes;
              const favorites = typeof next.favorites_count === 'number' ? next.favorites_count : p.favorites;
              const comments = typeof next.comments_count === 'number' ? next.comments_count : p.comments;
              return { ...p, likes, favorites, comments };
            }),
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser?.id]);



  const handleToggleFavVisibility = async (next: boolean) => {
    setFavIsPublic(next);
    if (!authUser?.id) return;
    const supabase = getSupabaseBrowserClient();
    await supabase
      .from('users')
      .update({ favorites_visibility: next ? 'public' : 'private' })
      .eq('id', authUser.id);
  };

  if (!loading && !profile) {
    return <div className="page-fade py-24 text-center opacity-50 caps">{t('please_sign_in')}</div>;
  }

  const isVoyageur = profile?.is_customer ?? false;
  const isPhotographer = profile?.photographer_status === 'approved';

  const persona = {
    username: profile?.username || '',
    name: profile?.display_name || '',
    avatar: profile?.avatar_url || '',
    cover: profile?.cover_url || '',
    loc: profile?.location || 'Not set',
    bio: profile?.bio || '',
    website: profile?.portfolio_url || '',
    isCustomer: profile?.is_customer,
    followers: profile?.followers_count || 0,
    photos: myPhotos.length,
    isAmbassador: profile?.is_ambassador || false,
    joined: profile?.created_at || '',
    socialTwitter: profile?.social_twitter || '',
    socialInstagram: profile?.social_instagram || '',
    socialFacebook: profile?.social_facebook || '',
    cameras: [],
  } as Photographer;

  const sections = [
    { id: 'dashboard', label: t('nav_dashboard'), path: '/me' },
    { id: 'photos', label: t('nav_photos'), path: '/me/photos', count: myPhotos.length },
    { id: 'favorites', label: t('nav_favorites'), path: '/me/favorites', count: favs.length },
    { id: 'stats', label: t('nav_stats'), path: '/me/stats' },
    { id: 'notifications', label: t('nav_notifications') || 'Notifications', path: '/me/notifications' },
    { id: 'settings', label: t('nav_settings'), path: '/me/settings' },
  ];

  return (
    <div className="page-fade">
      <div className="hidden md:block relative group">
        <div
          {...(cover.editing ? cover.dragHandlers : {})}
          className={cover.editing ? 'cursor-move select-none touch-none' : ''}
        >
          <PageCover
            src={profile?.cover_url || undefined}
            objectPosition={cover.position}
            eyebrow={t('your_account')}
            title="Dashboard"
          />
        </div>

        {cover.editing && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex justify-center pointer-events-none">
            <span className="bg-black/55 text-white px-4 py-1.5 caps text-[10px] tracking-[.14em] backdrop-blur-sm">
              {t('reposition_hint')}
            </span>
          </div>
        )}

        <div className="absolute top-6 right-10 z-20 flex gap-2">
          {!cover.editing ? (
            <>
              <label className="bg-black/50 text-white px-4 py-2 text-[11px] tracking-[.1em] uppercase cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80">
                {uploadingCover ? t('uploading') : t('change_cover')}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingCover} onChange={handleCoverUpload} />
              </label>
              {profile?.cover_url && (
                <button
                  type="button"
                  onClick={cover.start}
                  className="bg-black/50 text-white px-4 py-2 text-[11px] tracking-[.1em] uppercase cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  {t('reposition_cover')}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={cover.save}
                disabled={cover.saving}
                className="bg-white text-black px-4 py-2 text-[11px] tracking-[.1em] uppercase cursor-pointer hover:bg-white/85 disabled:opacity-60"
              >
                {cover.saving ? t('uploading') : t('reposition_save')}
              </button>
              <button
                type="button"
                onClick={cover.cancel}
                disabled={cover.saving}
                className="bg-black/50 text-white px-4 py-2 text-[11px] tracking-[.1em] uppercase cursor-pointer hover:bg-black/80"
              >
                {t('reposition_cancel')}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="md:hidden">
        {loading ? (
          <div className="px-6 py-10 animate-pulse">
            <div className="h-3 w-24 bg-tile mb-3" />
            <div className="h-10 w-2/3 bg-tile mb-8" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[4/5] bg-tile" />
              ))}
            </div>
          </div>
        ) : (
          <MobileMe
            section={section}
            profile={profile}
            myPhotos={myPhotos}
            favs={favs}
            favDates={favDates}
            isVoyageur={isVoyageur}
            favoritesCount={favs.length}
            daysLeft={daysLeft}
            voyageurRank={voyageurRank}
            topCategory={topCategory}
          />
        )}
      </div>
      <div
        className="hidden md:grid wrap items-start pt-12 px-10 pb-24 grid-cols-[240px_1fr] gap-14"
      >
        {loading ? (
          <>
            <MeSidebarSkeleton />
            <main>
              <MeContentSkeleton />
            </main>
          </>
        ) : (
          <>
            <MeSidebar
              persona={persona}
              isVoyageur={isVoyageur}
              isPhotographer={isPhotographer}
              sections={sections}
              activeSection={section}
              onNavigate={navigateSection}
              onAvatarUpdated={(url) => setProfile((p: any) => ({ ...p, avatar_url: url }))}
            />

            <main>
              {section === 'dashboard' && (
                <MeDashboard
                  persona={persona}
                  isVoyageur={isVoyageur}
                  isPhotographer={isPhotographer}
                  myPhotos={myPhotos}
                  followers={profile.followers_count ?? 0}
                  following={profile.following_count ?? 0}
                  userId={profile.id}
                  onPhotoDeleted={handlePhotoDeleted}
                />
              )}
              {section === 'photos' && (
                <MePhotos
                  persona={persona}
                  myPhotos={myPhotos}
                  isPhotographer={isPhotographer || isVoyageur}
                  isVoyageur={isVoyageur}
                  onPhotoUploaded={() => fetchPhotos(profile?.username || '')}
                  onPhotoDeleted={handlePhotoDeleted}
                />
              )}
              {section === 'favorites' && (
                <MeFavorites
                  favs={favs}
                  isPublic={favIsPublic}
                  onToggleVisibility={handleToggleFavVisibility}
                />
              )}
              {section === 'stats' && <MeStats persona={persona} myPhotos={myPhotos} favDates={favDates} />}
              {section === 'settings' && (
                <MeSettings persona={persona} isVoyageur={isVoyageur} />
              )}
              {section === 'notifications' && <MeNotifications />}
            </main>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
