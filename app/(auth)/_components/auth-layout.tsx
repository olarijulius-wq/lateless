import Link from 'next/link';
import type { ReactNode } from 'react';
import { lusitana } from '@/app/ui/fonts';

type AuthLayoutProps = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
};

export default function AuthLayout({
  title,
  subtitle,
  children,
  maxWidthClassName = 'max-w-lg',
}: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f7f4] px-6 py-10 text-zinc-900 dark:bg-black dark:text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_820px_at_50%_55%,rgba(255,255,255,0.75),rgba(245,245,244,0.95)_68%)] dark:bg-[radial-gradient(1200px_820px_at_50%_55%,rgba(0,0,0,0.24),rgba(0,0,0,0.9)_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,transparent_58%,rgba(255,255,255,0.18)_59%,rgba(255,255,255,0.26)_60%,rgba(255,255,255,0.1)_62%,transparent_67%,transparent_100%),radial-gradient(900px_700px_at_95%_35%,rgba(180,180,160,0.14),rgba(180,180,160,0.05)_45%,transparent_72%)] dark:bg-[linear-gradient(120deg,transparent_0%,transparent_56%,rgba(255,255,255,0.08)_58%,rgba(255,255,255,0.16)_59%,rgba(255,255,255,0.06)_61%,transparent_66%,transparent_100%),radial-gradient(900px_700px_at_95%_35%,rgba(255,255,255,0.16),rgba(255,255,255,0.05)_45%,transparent_72%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(320deg,transparent_0%,transparent_54%,rgba(255,255,255,0.11)_56%,rgba(255,255,255,0.2)_57%,rgba(255,255,255,0.08)_60%,transparent_65%,transparent_100%),radial-gradient(900px_700px_at_18%_92%,rgba(21,128,61,0.12),rgba(21,128,61,0.05)_45%,transparent_72%)] dark:bg-[linear-gradient(320deg,transparent_0%,transparent_54%,rgba(255,255,255,0.08)_56%,rgba(255,255,255,0.15)_57%,rgba(255,255,255,0.06)_60%,transparent_65%,transparent_100%),radial-gradient(900px_700px_at_18%_92%,rgba(255,255,255,0.11),rgba(255,255,255,0.05)_45%,transparent_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_900px_at_110%_-10%,rgba(255,255,255,0.22),rgba(255,255,255,0.05)_45%,transparent_70%)] dark:bg-[radial-gradient(1200px_900px_at_110%_-10%,rgba(255,255,255,0.13),rgba(255,255,255,0.05)_45%,transparent_70%)]" />
      </div>

      <Link
        href="/"
        className="absolute left-6 top-6 z-10 text-sm text-zinc-600 transition hover:text-zinc-900 dark:text-white/70 dark:hover:text-white"
      >
        {'\u2190'} Home
      </Link>

      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className={`w-full ${maxWidthClassName}`}>
          <div className="space-y-7 text-center">
            <div className="flex justify-center">
              <Link
                href="/"
                className={`${lusitana.className} text-[2rem] leading-none tracking-[0.01em] text-zinc-950 dark:text-white`}
              >
                Lateless
              </Link>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-sm text-zinc-600 dark:text-white/70">{subtitle}</p>
              ) : null}
            </div>

            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
