import { Metadata } from 'next';
import SignupForm from '@/app/ui/signup-form';
import { lusitana } from '@/app/ui/fonts';

export const metadata: Metadata = {
  title: 'Sign up',
};

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <h1 className={`${lusitana.className} mb-2 text-2xl text-slate-900 dark:text-slate-100`}>
          Create your account
        </h1>
        <p className="mb-6 text-sm text-neutral-600 dark:text-slate-400">
          Sign up to access your dashboard.
        </p>
        <SignupForm />
      </div>
    </main>
  );
}
