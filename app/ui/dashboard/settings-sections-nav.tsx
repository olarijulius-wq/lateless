'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  NEUTRAL_ACTIVE_ITEM_CLASSES,
  NEUTRAL_FOCUS_RING_CLASSES,
  NEUTRAL_INACTIVE_ITEM_CLASSES,
} from '@/app/ui/dashboard/neutral-interaction';
import type { SettingsSection } from '@/app/lib/settings-sections';

export default function SettingsSectionsNav({
  sections,
}: {
  sections: SettingsSection[];
}) {
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
              `inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition ${NEUTRAL_FOCUS_RING_CLASSES}`,
              active
                ? NEUTRAL_ACTIVE_ITEM_CLASSES
                : `border border-transparent ${NEUTRAL_INACTIVE_ITEM_CLASSES}`,
            )}
          >
            {section.name}
          </Link>
        );
      })}
    </div>
  );
}
