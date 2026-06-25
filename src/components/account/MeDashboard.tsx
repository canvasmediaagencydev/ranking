'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoGrid } from '@/components/photo/PhotoGrid';
import { DashStat, ActionCard } from './primitives';
import { TravellersAwardsCard } from './TravellersAwardsCard';
import { FollowListModal, type FollowTab } from './FollowListModal';
import { useNotifications } from '@/hooks/useNotifications';
import { formatNotificationBody } from '@/lib/data/notifications';
import { useTranslations } from 'next-intl';
import { TranslatedNotificationBody, TranslatedTimeAgo } from '@/components/layout/NotificationsBell';
import type { Photographer, Photo } from '@/lib/types';
import { getCashbackPercentage } from '@/lib/ranking-system';
import { MeStanding } from './MeStanding';
import { MeGoScore } from './MeGoScore';
const ACTIVITY_PAGE = 5;

// timeAgoThai removed in favor of TranslatedTimeAgo

interface MeDashboardProps {
  persona: Photographer;
  isVoyageur: boolean;
  isPhotographer: boolean;
  myPhotos: Photo[];
  followers: number;
  following: number;
  userId?: string;
  onPhotoDeleted?: (id: string) => void;
}

export function MeDashboard({ persona, isVoyageur, isPhotographer, myPhotos, followers, following, userId, onPhotoDeleted }: MeDashboardProps) {
  const router = useRouter();
  const t = useTranslations('MePage');
  const { notifications } = useNotifications();
  const [followModalTab, setFollowModalTab] = useState<FollowTab | null>(null);

  const totalLikes = myPhotos.reduce((s, p) => s + p.likes, 0);
  const totalFav = myPhotos.reduce((s, p) => s + p.favorites, 0);
  const totalComments = myPhotos.reduce((s, p) => s + p.comments, 0);
  const totalPulse = myPhotos.reduce((s, p) => s + p.pulse, 0);
  const editorPicks = myPhotos.filter((p) => p.picks.includes('editor')).length;

  const [activityVisible, setActivityVisible] = useState(ACTIVITY_PAGE);
  const visibleActivity = notifications.slice(0, activityVisible);
  const hiddenActivity = Math.max(0, notifications.length - visibleActivity.length);

  return (
    <div>
      {/* Travellers Awards status card — top of dashboard for Travellers */}
      {isVoyageur && (
        <div className="mb-8">
          <TravellersAwardsCard />
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-rule">
        <DashStat n={myPhotos.length} l={t('photos')} />
        <DashStat n={followers.toLocaleString()} l={t('followers')} border onClick={userId ? () => setFollowModalTab('followers') : undefined} />
        <DashStat n={totalLikes.toLocaleString()} l={t('likes_received')} border />
        <DashStat n={totalPulse.toFixed(0)} l={t('pulse')} border />
      </div>
      <div className="mt-3 mono text-[11px] opacity-55 tracking-[.08em] uppercase">
        {userId ? (
          <button
            onClick={() => setFollowModalTab('following')}
            className="bg-transparent border-0 p-0 cursor-pointer uppercase tracking-[.08em] hover:opacity-100 transition-opacity"
          >
            {t('following')} {following.toLocaleString()}
          </button>
        ) : (
          <>{t('following')} {following.toLocaleString()}</>
        )}
        {' · '}{t('favorites')} {totalFav.toLocaleString()}
      </div>

      {/* Photographer pick alert */}
      {isPhotographer && editorPicks > 0 && (
        <div className="mt-8 px-7 py-6 bg-cream border border-rule flex justify-between items-center">
          <div>
            <div className="caps opacity-55 mb-2">{t('rank_master_recognition')}</div>
            <div className="th text-[17px] font-medium">
              คุณได้รับ Rank Master {editorPicks} ครั้งในฤดูกาลนี้ — ติดอันดับ Top 10 ของ Leaderboard
            </div>
          </div>
          <button onClick={() => router.push('/me/stats')} className="btn btn-sm">
            {t('view_stats')}
          </button>
        </div>
      )}

      {/* Your standing (per-category rank) + GoScore breakdown — real V4 data */}
      <MeStanding userId={userId} myPhotos={myPhotos} />
      <MeGoScore myPhotos={myPhotos} />

      {/* Quick actions */}
      <div className="mt-14">
        <div className="caps opacity-55 mb-5">{t('quick_actions')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ActionCard title={t('submit_new_photo')} sub={t('one_upload_per_day')} onClick={() => router.push('/upload')} />
          <ActionCard
            title={t('reply_comments')}
            sub={`${totalComments.toLocaleString()} ${t('total_comments')}`}
            onClick={() => router.push('/me/photos')}
          />
          <ActionCard title={t('vote_favorite')} sub={t('discover_new')} onClick={() => router.push('/explore')} />
        </div>
      </div>

      {/* Recent photos */}
      {myPhotos.length > 0 && (
        <div className="mt-14">
          <div className="flex justify-between items-baseline mb-5">
            <div className="caps opacity-55">{t('your_photos_this_season')}</div>
            <button
              onClick={() => router.push('/me/photos')}
              className="caps cursor-pointer border-b border-rule pb-[3px] opacity-65"
            >
              {t('see_all')} →
            </button>
          </div>
          <PhotoGrid photos={myPhotos.slice(0, 4)} cols={4} uniform deletable onDeleted={onPhotoDeleted} />
        </div>
      )}

      {/* Activity feed */}
      <div className="mt-14">
        <div className="caps opacity-55 mb-5">{t('recent_activity')}</div>
        {notifications.length === 0 ? (
          <div className="opacity-50 text-[13px] py-4">{t('no_recent_activity')}</div>
        ) : (
          <>
            <ul className="list-none p-0 m-0 text-[14px] leading-[1.7]">
              {visibleActivity.map((n) => (
                <li
                  key={n.id}
                  className="th grid gap-6 py-[14px] border-b border-rule grid-cols-[120px_1fr] cursor-pointer hover:opacity-80"
                  onClick={() => { if (n.related_url) router.push(n.related_url); }}
                >
                  <span className="mono text-[11px] opacity-55 tracking-[.08em] pt-[2px] uppercase">
                    <TranslatedTimeAgo iso={n.created_at} />
                  </span>
                  <span><TranslatedNotificationBody body={formatNotificationBody(n)} /></span>
                </li>
              ))}
            </ul>
            {hiddenActivity > 0 && (
              <button
                type="button"
                className="mt-6 mx-auto block caps text-[11px] tracking-[0.12em] opacity-65 hover:opacity-100 border-b border-rule pb-[2px]"
                onClick={() => setActivityVisible((c) => c + ACTIVITY_PAGE)}
              >
                {t('read_more')} ({hiddenActivity})
              </button>
            )}
          </>
        )}
      </div>

      {userId && (
        <FollowListModal
          open={followModalTab !== null}
          onOpenChange={(o) => { if (!o) setFollowModalTab(null); }}
          userId={userId}
          username={persona.username}
          initialTab={followModalTab ?? 'followers'}
          followersCount={followers}
          followingCount={following}
        />
      )}
    </div>
  );
}
