'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const sections = [
  { name: 'Overview', href: '/dashboard/settings' },
  { name: 'Usage', href: '/dashboard/settings/usage' },
  { name: 'Billing', href: '/dashboard/settings/billing' },
  { name: 'Team', href: '/dashboard/settings/team' },
  { name: 'Company', href: '/dashboard/settings/company-profile' },
  { name: 'SMTP', href: '/dashboard/settings/smtp' },
  { name: 'Unsubscribe', href: '/dashboard/settings/unsubscribe' },
  { name: 'Documents', href: '/dashboard/settings/documents' },
];

export default function SettingsSectionsNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {sections.map((section) => {
        const active = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={clsx(
              'inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition',
              active
                ? 'border-slate-900 bg-black text-white ring-1 ring-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:ring-slate-500'
                : 'border-slate-900 bg-black text-white hover:bg-slate-900 dark:border-slate-800 dark:bg-black dark:text-slate-300 dark:hover:bg-slate-900',
            )}
          >
            {section.name}
          </Link>
        );
      })}
    </div>
  );
}
