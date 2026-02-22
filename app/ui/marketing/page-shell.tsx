import type { ReactNode } from 'react';
import clsx from 'clsx';
import TopNav from '@/app/ui/marketing/top-nav';
import PublicFooter from '@/app/ui/marketing/public-footer';
import {
  MARKETING_CANVAS,
  MARKETING_CONTAINER_READING,
  MARKETING_PAGE_PY,
  MARKETING_SKIP_LINK,
} from '@/app/ui/marketing/tokens';

type MarketingPageShellProps = {
  children: ReactNode;
  mainId?: string;
  mainClassName?: string;
};

export default function MarketingPageShell({
  children,
  mainId = 'main-content',
  mainClassName,
}: MarketingPageShellProps) {
  const resolvedMainClassName = mainClassName ?? `${MARKETING_CONTAINER_READING} ${MARKETING_PAGE_PY}`;

  return (
    <div className={MARKETING_CANVAS}>
      <a href={`#${mainId}`} className={MARKETING_SKIP_LINK}>
        Skip to content
      </a>
      <TopNav />
      <main id={mainId} className={clsx('relative z-10', resolvedMainClassName)}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
