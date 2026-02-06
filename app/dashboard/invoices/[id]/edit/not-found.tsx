import Link from 'next/link';
import { FaceFrownIcon } from '@heroicons/react/24/outline';
 
export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2">
      <FaceFrownIcon className="w-10 text-slate-500" />
      <h2 className="text-xl font-semibold">404 Not Found</h2>
      <p>Could not find the requested invoice.</p>
      <Link
        href="/dashboard/invoices"
        className="mt-4 inline-flex items-center rounded-xl border border-slate-700/70 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition duration-200 ease-out hover:bg-slate-800 hover:scale-[1.01]"
      >
        Go Back
      </Link>
    </main>
  );
}
