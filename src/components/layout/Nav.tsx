'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useApp } from '@/providers/AppProvider';
import { setLocale } from '@/app/actions/locale';
import { RoleRibbon } from './RoleRibbon';
import { NotificationsBell } from './NotificationsBell';

const CENTER_LINKS: { to: string; translationKey: string }[] = [
  // { to: '/hall-of-fame', translationKey: 'hall_of_fame' },
  { to: '/explore', translationKey: 'explore' },
  { to: '/photographers', translationKey: 'photographers' },
  { to: '/for-customers', translationKey: 'for_voyageurs' },
  // { to: '/faq', translationKey: 'faq' },
];

export function Nav() {
  const pathname = usePathname();
  const t = useTranslations('Nav');
  const locale = useLocale();
  const { authUser, toggleSideMenu, theme, setTheme } = useApp();

  const isActive = (to: string) =>
    pathname === to || (to !== '/' && pathname.startsWith(to));

  const avatarSrc = authUser?.user_metadata?.avatar_url || '';
  const displayName = authUser?.user_metadata?.full_name || authUser?.email || 'User';

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <RoleRibbon />
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-left">
            <button
              className="nav-toggle"
              onClick={toggleSideMenu}
              aria-label="Open menu"
              title="Menu"
            >
              <svg viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.4" fill="none">
                <line x1="2" y1="5" x2="16" y2="5" />
                <line x1="2" y1="9" x2="16" y2="9" />
                <line x1="2" y1="13" x2="16" y2="13" />
              </svg>
            </button>
            <Link href="/" className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-white.png" alt="" aria-hidden className="logo-img" />
              <span>GOGRAPHY</span>
            </Link>
          </div>

          <div className="nav-center">
            {CENTER_LINKS.map((l) => (
              <Link
                key={l.to}
                href={l.to}
                className={'nav-link ' + (isActive(l.to) ? 'active' : '')}
              >
                {t(l.translationKey)}
              </Link>
            ))}
          </div>

          <div className="nav-right flex items-center gap-3.5">
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  await setLocale(locale === 'th' ? 'en' : 'th');
                  window.location.reload();
                }}
                className="text-[10px] font-mono tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity"
              >
                {locale === 'th' ? 'EN' : 'TH'}
              </button>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle theme"
                title="Theme"
                className="inline-flex items-center text-fg opacity-60 hover:opacity-100 transition-opacity"
              >
                {theme === 'dark' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
              </button>
            </div>
            <span className="h-4 w-px bg-[var(--rule)]" aria-hidden />
            {authUser && <NotificationsBell />}
            {!authUser ? (
              <Link href="/login" className="nav-link nav-signin whitespace-nowrap">
                {t('login')}
              </Link>
            ) : (
              <Link href="/me" className="flex items-center">
                <div className="w-7 h-7 rounded-full bg-tile overflow-hidden flex items-center justify-center border border-rule">
                  {avatarSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={avatarSrc}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="caps text-[10px] opacity-65">{displayName.charAt(0)}</span>
                  )}
                </div>
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
