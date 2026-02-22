import clsx from 'clsx';
import { lusitana } from '@/app/ui/fonts';

export const DASHBOARD_PAGE_TITLE_CLASSES = `${lusitana.className} text-xl text-slate-900 dark:text-slate-100 md:text-2xl`;

type DashboardPageTitleProps = {
  title: string;
  kicker?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export default function DashboardPageTitle({
  title,
  kicker,
  description,
  meta,
  actions,
  className,
}: DashboardPageTitleProps) {
  return (
    <header className={clsx('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {kicker ? (
          <div className="mb-1 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
            {kicker}
          </div>
        ) : null}
        <h1 className={DASHBOARD_PAGE_TITLE_CLASSES}>{title}</h1>
        {description ? (
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</div>
        ) : null}
        {meta ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-500">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
