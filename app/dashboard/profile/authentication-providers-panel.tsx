'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { primaryButtonClasses } from '@/app/ui/button';
import { NEUTRAL_FOCUS_RING_CLASSES } from '@/app/ui/dashboard/neutral-interaction';

type ProviderId = 'google' | 'github';

type ProviderConnection = {
  provider: ProviderId;
  connectedAt: string;
};

type AuthenticationProvidersPanelProps = {
  connections: ProviderConnection[];
  googleEnabled: boolean;
  githubEnabled: boolean;
};

function formatConnectedDate(value: string) {
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return 'an unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(asDate);
}

export function AuthenticationProvidersPanel({
  connections,
  googleEnabled,
  githubEnabled,
}: AuthenticationProvidersPanelProps) {
  const router = useRouter();
  const [linkingProvider, setLinkingProvider] = useState<ProviderId | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<ProviderId | null>(
    null,
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const connectionByProvider = new Map(
    connections.map((connection) => [connection.provider, connection]),
  );

  const providers = [
    { id: 'google' as const, label: 'Google', enabled: googleEnabled },
    { id: 'github' as const, label: 'GitHub', enabled: githubEnabled },
  ];

  return (
    <div className="space-y-3">
      {providers.map((provider) => {
        const connected = connectionByProvider.get(provider.id);
        const isConnected = Boolean(connected);
        const isLinking = linkingProvider === provider.id;
        const isDisconnecting = disconnectingProvider === provider.id;

        return (
          <div
            key={provider.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black"
          >
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {provider.label}
              </h3>
              {isConnected ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Connected on {formatConnectedDate(connected!.connectedAt)}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Not connected
                </p>
              )}
            </div>

            {isConnected ? (
              <button
                type="button"
                disabled={isDisconnecting}
                onClick={async () => {
                  setMessage(null);
                  setDisconnectingProvider(provider.id);

                  try {
                    const response = await fetch(
                      `/api/account/auth-connections?provider=${provider.id}`,
                      { method: 'DELETE' },
                    );
                    const payload = (await response
                      .json()
                      .catch(() => null)) as { message?: string; removed?: boolean } | null;

                    if (!response.ok) {
                      setMessage({
                        ok: false,
                        text:
                          payload?.message ??
                          'Could not disconnect this provider. Try again.',
                      });
                      return;
                    }

                    setMessage({
                      ok: true,
                      text: payload?.removed
                        ? `${provider.label} disconnected.`
                        : `${provider.label} was already disconnected.`,
                    });
                    router.refresh();
                  } catch {
                    setMessage({
                      ok: false,
                      text: 'Could not disconnect this provider. Try again.',
                    });
                  } finally {
                    setDisconnectingProvider(null);
                  }
                }}
                className={`inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 px-3 text-sm font-medium text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 ${NEUTRAL_FOCUS_RING_CLASSES}`}
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            ) : (
              <button
                type="button"
                disabled={isLinking || !provider.enabled}
                onClick={async () => {
                  setMessage(null);
                  setLinkingProvider(provider.id);
                  try {
                    await signIn(provider.id, { callbackUrl: '/dashboard/profile' });
                  } finally {
                    setLinkingProvider(null);
                  }
                }}
                className={clsx(
                  primaryButtonClasses,
                  !provider.enabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {provider.enabled
                  ? isLinking
                    ? 'Opening...'
                    : `Link ${provider.label}`
                  : `${provider.label} not configured`}
              </button>
            )}
          </div>
        );
      })}
      {message ? (
        <p
          className={clsx(
            'text-sm',
            message.ok
              ? 'text-slate-700 dark:text-slate-300'
              : 'text-rose-700 dark:text-rose-300',
          )}
          aria-live="polite"
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
