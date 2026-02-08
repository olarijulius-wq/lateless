'use client';

import {
  UserGroupIcon,
  HomeIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

// Map of links to display in the side navigation.
const links = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  {
    name: 'Invoices',
    href: '/dashboard/invoices',
    icon: DocumentDuplicateIcon,
  },
  { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
  { name: 'Late payers', href: '/dashboard/late-payers', icon: ClockIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        const isActive =
          link.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.name}
            href={link.href}
            className={clsx(
              'flex h-[44px] grow items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition duration-200 ease-out hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 md:flex-none md:justify-start dark:border-neutral-900 dark:bg-black dark:text-neutral-400 dark:hover:border-neutral-800 dark:hover:bg-neutral-950 dark:hover:text-neutral-100',
              {
                'border-neutral-300 bg-neutral-100 text-neutral-900 shadow-[0_0_0_1px_rgba(115,115,115,0.25)] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-[0_0_0_1px_rgba(163,163,163,0.25)]':
                  isActive,
              },
            )}
          >
            <LinkIcon className="w-5" />
            <p className="hidden md:block">{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}
