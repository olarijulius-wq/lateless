import Link from 'next/link';
import { FaceFrownIcon } from '@heroicons/react/24/outline';
import { secondaryButtonClasses } from '@/app/ui/button';
 
export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2">
      <FaceFrownIcon className="w-10 text-slate-500" />
      <h2 className="text-xl font-semibold">404 Not Found</h2>
      <p>Could not find the requested invoice.</p>
      <Link
        href="/dashboard/invoices"
        className={`${secondaryButtonClasses} mt-4`}
      >
        Go Back
      </Link>
    </main>
  );
}
