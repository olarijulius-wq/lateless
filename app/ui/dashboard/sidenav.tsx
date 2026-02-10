import Link from 'next/link';
import NavLinks from '@/app/ui/dashboard/nav-links';
import { dashboardLinks } from '@/app/ui/dashboard/nav-links-data';
import AcmeLogo from '@/app/ui/acme-logo';
import {
  Bars3Icon,
  ChevronUpIcon,
  Cog6ToothIcon,
  HomeIcon,
  PowerIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { signOut } from '@/auth';
import { auth } from '@/auth';
import ThemeToggleMenuItem from '@/app/ui/dashboard/theme-toggle-menu-item';

function getInitial(value: string) {
  const initial = value.trim().charAt(0).toUpperCase();
  return initial || '?';
}

export default async function SideNav() {
  const session = await auth();
  const userEmail = session?.user?.email ?? '';
  const userName = session?.user?.name?.trim() || '';
  const identityLabel = userName || userEmail || 'Account';
  const avatarInitial = getInitial(userName || userEmail || '?');

  return (
    <div className="flex h-full flex-col gap-2 px-3 py-4 md:px-2">
      <details className="group md:hidden">
        <summary className="relative z-40 mb-2 flex h-20 cursor-pointer list-none items-end justify-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] transition dark:border-neutral-900 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
          <Bars3Icon className="h-6 w-6 text-neutral-700 dark:text-neutral-200" />
          <div className="w-32 text-slate-900 dark:text-slate-100">
            <AcmeLogo />
          </div>
        </summary>
        <div className="fixed inset-y-0 left-0 z-30 w-72 border-r border-neutral-200 bg-white p-3 pt-24 dark:border-neutral-900 dark:bg-black">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="w-32 text-slate-900 dark:text-slate-100">
              <AcmeLogo />
            </div>
          </div>
          <div className="space-y-1">
            {dashboardLinks.map((link) => {
              const LinkIcon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                >
                  <LinkIcon className="h-4 w-4" />
                  {link.name}
                </Link>
              );
            })}
          </div>
          <div className="my-2 h-px bg-neutral-200 dark:bg-neutral-900"></div>
          <div className="space-y-1">
            {userEmail ? (
              <p className="truncate px-3 py-1 text-xs text-neutral-500 dark:text-neutral-400">
                {userEmail}
              </p>
            ) : null}
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              <UserCircleIcon className="h-4 w-4" />
              My profile
            </Link>
            <ThemeToggleMenuItem staticLabel="Toggle theme" />
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              <HomeIcon className="h-4 w-4" />
              Homepage
            </Link>
            <Link
              href="/onboarding"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            >
              <UserCircleIcon className="h-4 w-4" />
              Onboarding
            </Link>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">
                <PowerIcon className="h-4 w-4" />
                Log out
              </button>
            </form>
          </div>
        </div>
      </details>

      <div className="hidden md:flex md:h-full md:flex-col">
        <Link
          className="mb-2 flex h-20 items-end justify-start rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] transition md:h-40 dark:border-neutral-900 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]"
          href="/"
        >
          <div className="w-32 text-slate-900 dark:text-slate-100 md:w-40">
            <AcmeLogo />
          </div>
        </Link>
        <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2">
          <NavLinks />
          <div className="hidden h-auto w-full grow rounded-md border border-neutral-200 bg-white md:block dark:border-neutral-900 dark:bg-black"></div>
          <details className="group relative">
            <summary className="flex h-[52px] w-full cursor-pointer list-none items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 text-left text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-900 dark:bg-black dark:text-neutral-200 dark:hover:border-neutral-800 dark:hover:bg-neutral-950">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black bg-black text-xs font-semibold text-white dark:border-neutral-700 dark:bg-black dark:text-neutral-200">
                {avatarInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                  {identityLabel}
                </p>
                {userEmail ? (
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {userEmail}
                  </p>
                ) : null}
              </div>
              <ChevronUpIcon className="h-4 w-4 text-neutral-500 transition group-open:rotate-180 dark:text-neutral-400" />
            </summary>
            <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl backdrop-blur dark:border-neutral-900 dark:bg-black">
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-500">
                Account
              </p>
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              >
                <UserCircleIcon className="h-4 w-4" />
                My profile
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              >
                <Cog6ToothIcon className="h-4 w-4" />
                Settings
              </Link>
              <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-500">
                Preferences
              </p>
              <ThemeToggleMenuItem />
              <Link
                href="/"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              >
                <HomeIcon className="h-4 w-4" />
                Homepage
              </Link>
              <Link
                href="/onboarding"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              >
                <UserCircleIcon className="h-4 w-4" />
                Onboarding
              </Link>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">
                  <PowerIcon className="h-4 w-4" />
                  Logout
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
