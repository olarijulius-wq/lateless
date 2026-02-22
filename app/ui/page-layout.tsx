import clsx from 'clsx';
import DashboardPageTitle from '@/app/ui/dashboard/page-title';

type PageShellProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function PageShell({
  title,
  subtitle,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <main className={clsx('mx-auto w-full max-w-6xl space-y-6', className)}>
      <DashboardPageTitle title={title} description={subtitle} actions={actions} />
      {children}
    </main>
  );
}

type SectionCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionCard({ children, className }: SectionCardProps) {
  return (
    <section
      className={clsx(
        'rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-900 dark:bg-neutral-950',
        className,
      )}
    >
      {children}
    </section>
  );
}

type TwoColumnDetailProps = {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  className?: string;
};

export function TwoColumnDetail({
  primary,
  secondary,
  className,
}: TwoColumnDetailProps) {
  return (
    <div className={clsx('grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]', className)}>
      <div className="space-y-4">{primary}</div>
      <aside className="space-y-4">{secondary}</aside>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-8 text-center dark:border-neutral-800 dark:bg-neutral-950',
        className,
      )}
    >
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
