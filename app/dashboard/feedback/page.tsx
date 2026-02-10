import { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import { redirect } from 'next/navigation';
import { requireUserEmail } from '@/app/lib/data';
import {
  FEEDBACK_MIGRATION_FILE,
  fetchLatestFeedback,
  isFeedbackAdminEmail,
  isFeedbackMigrationRequiredError,
} from '@/app/lib/feedback';

export const metadata: Metadata = {
  title: 'Feedback',
};

export default async function Page() {
  const userEmail = await requireUserEmail();
  if (!isFeedbackAdminEmail(userEmail)) {
    redirect('/dashboard');
  }

  let migrationRequired = false;
  let items: Awaited<ReturnType<typeof fetchLatestFeedback>> = [];
  try {
    items = await fetchLatestFeedback(100);
  } catch (error) {
    if (isFeedbackMigrationRequiredError(error)) {
      migrationRequired = true;
    } else {
      throw error;
    }
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <main className="w-full space-y-4">
      <h1 className={`${lusitana.className} text-xl text-slate-900 dark:text-slate-100 md:text-2xl`}>
        Feedback
      </h1>

      {migrationRequired ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-100 p-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-sm font-semibold">Feedback migration required</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-100/80">
            Run DB migration {FEEDBACK_MIGRATION_FILE} to enable feedback storage.
          </p>
        </div>
      ) : null}

      {!migrationRequired && items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[0_18px_35px_rgba(0,0,0,0.35)]">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No feedback yet.
          </p>
        </div>
      ) : null}

      {!migrationRequired && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[0_18px_35px_rgba(0,0,0,0.35)]"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.userEmail}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatter.format(new Date(item.createdAt))}
                </p>
                {item.pagePath ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {item.pagePath}
                  </p>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                {item.message}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </main>
  );
}
