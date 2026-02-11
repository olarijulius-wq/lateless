'use client';

import clsx from 'clsx';
import { signIn } from 'next-auth/react';
import type { ReactElement } from 'react';
import { useSearchParams } from 'next/navigation';

type SocialAuthButtonsProps = {
  googleEnabled: boolean;
  githubEnabled: boolean;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path
        d="M21.6 12.3c0-.7-.1-1.3-.2-1.9H12v3.5h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1ZM12 22c2.7 0 4.9-.9 6.6-2.5l-3.2-2.5a6 6 0 0 1-9-3.2H3.1v2.6A10 10 0 0 0 12 22ZM6.3 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8l3.2-2.6ZM12 6a5.4 5.4 0 0 1 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 3.1 7.6l3.2 2.6A6 6 0 0 1 12 6Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12 .6a11.4 11.4 0 0 0-3.6 22.2c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1 .1.6 2.8 3.3 2 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.4 1.3-3.3-.1-.3-.6-1.6.1-3.2 0 0 1-.3 3.4 1.3a11.2 11.2 0 0 1 6.2 0c2.3-1.6 3.4-1.3 3.4-1.3.7 1.6.3 2.9.1 3.2.8.9 1.3 2 1.3 3.3 0 4.5-2.7 5.5-5.3 5.8.4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6A11.4 11.4 0 0 0 12 .6Z" />
    </svg>
  );
}

export default function SocialAuthButtons({
  googleEnabled,
  githubEnabled,
}: SocialAuthButtonsProps) {
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const items = [
    {
      id: 'google',
      label: 'Google',
      icon: <GoogleIcon />,
      available: googleEnabled,
    },
    {
      id: 'github',
      label: 'GitHub',
      icon: <GitHubIcon />,
      available: githubEnabled,
    },
  ] as Array<{
    id: string;
    label: string;
    icon: ReactElement;
    available: boolean;
  }>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={
              item.available ? () => signIn(item.id, { callbackUrl }) : undefined
            }
            disabled={!item.available}
            className={clsx(
              'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 text-sm font-medium transition',
              'col-span-1',
              item.available
                ? 'text-white/90 hover:border-white/20 hover:bg-white/8'
                : 'cursor-not-allowed text-white/45',
            )}
          >
            <span className={item.available ? 'text-white/70' : 'text-white/35'}>
              {item.icon}
            </span>
            <span className="truncate">
              {item.available ? item.label : `${item.label} · Not configured`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
