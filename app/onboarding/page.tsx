import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import SideNav from '@/app/ui/dashboard/sidenav';

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen flex-col bg-transparent md:flex-row md:overflow-hidden">
      <div className="w-full flex-none border-b border-neutral-200 bg-white md:w-64 md:border-b-0 md:border-r md:border-neutral-200 md:bg-white dark:md:border-neutral-800 dark:md:bg-black">
        <SideNav />
      </div>
      <main className="grow p-6 md:overflow-y-auto md:p-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_22px_60px_rgba(2,6,23,0.55)]">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Onboarding
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Onboarding coming soon
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            We are preparing a guided setup flow for your workspace.
          </p>
        </div>
      </main>
    </div>
  );
}
