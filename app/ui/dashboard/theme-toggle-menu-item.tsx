'use client';

import { useSyncExternalStore } from 'react';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/app/ui/theme/theme-provider';

type ThemeToggleMenuItemProps = {
  staticLabel?: string;
};

export default function ThemeToggleMenuItem({ staticLabel }: ThemeToggleMenuItemProps = {}) {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
      >
        <MoonIcon className="h-4 w-4" />
        {staticLabel ?? 'Toggle theme'}
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
    >
      {isDark ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
      {staticLabel ?? (isDark ? 'Light theme' : 'Dark theme')}
    </button>
  );
}
