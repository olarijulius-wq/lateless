import SideNav from '@/app/ui/dashboard/sidenav';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
 
export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen flex-col bg-transparent md:flex-row md:overflow-hidden">
      <div className="w-full flex-none border-b border-neutral-200 bg-white backdrop-blur md:w-64 md:border-b-0 md:border-r md:border-neutral-200 md:bg-white dark:md:border-neutral-800 dark:md:bg-black">
        <SideNav />
      </div>
      <div className="grow p-6 md:overflow-y-auto md:p-12">{children}</div>
    </div>
  );
}
