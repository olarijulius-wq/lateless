import SideNav from '@/app/ui/dashboard/sidenav';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import FeedbackButton from '@/app/ui/dashboard/feedback-button';
 
export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }
  const showFeedbackButton =
    session.user.email.trim().toLowerCase() === 'user@nextmail.com';

  return (
    <div className="flex h-screen flex-col bg-white text-slate-900 md:flex-row md:overflow-hidden dark:bg-black dark:text-slate-100">
      <div className="sticky top-0 z-50 w-full flex-none border-b border-neutral-200 bg-white pt-[env(safe-area-inset-top)] md:static md:z-auto md:w-64 md:border-b-0 md:border-r md:pt-0 dark:border-neutral-800 dark:bg-black">
        <SideNav />
      </div>
      <div className="grow bg-white p-6 md:overflow-y-auto md:p-12 dark:bg-black">
        {showFeedbackButton ? (
          <div className="mb-4 flex justify-end">
            <FeedbackButton />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
