'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { Button, primaryButtonClasses } from '@/app/ui/button';
import { NEUTRAL_FOCUS_RING_CLASSES } from '@/app/ui/dashboard/neutral-interaction';

type ProviderId = 'google' | 'github';

type ProviderConnection = {
  provider: ProviderId;
  connectedAt: string;
};

type AuthenticationProvidersPanelProps = {
  connections: ProviderConnection[];
  hasPassword: boolean;
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
  hasPassword,
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
  const connectedCount = connections.length;
  const isOAuthOnly = !hasPassword;
  const signInMethodsCount = connectedCount + (hasPassword ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Sign-in methods
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {hasPassword ? 'Password is set.' : 'No password set (OAuth-only).'}{' '}
          {connectedCount > 0
            ? `${connectedCount} OAuth provider${connectedCount === 1 ? '' : 's'} linked.`
            : 'No OAuth providers linked.'}
        </p>
      </div>
      {providers.map((provider) => {
        const connected = connectionByProvider.get(provider.id);
        const isConnected = Boolean(connected);
        const isLinking = linkingProvider === provider.id;
        const isDisconnecting = disconnectingProvider === provider.id;
        const remainingProvidersCount = connectedCount - (isConnected ? 1 : 0);
        const canDisconnect = !isConnected || remainingProvidersCount + (hasPassword ? 1 : 0) > 0;
        const disconnectDisabledReason =
          isConnected && !canDisconnect
            ? 'Set a password before disconnecting your last provider.'
            : null;

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
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isDisconnecting || !canDisconnect}
                  title={disconnectDisabledReason ?? undefined}
                  onClick={async () => {
                    if (!canDisconnect) return;
                    setMessage(null);
                    setDisconnectingProvider(provider.id);

                    try {
                      const response = await fetch(
                        `/api/account/auth-connections?provider=${provider.id}`,
                        { method: 'DELETE' },
                      );
                      const payload = (await response
                        .json()
                        .catch(() => null)) as
                        | { message?: string; removed?: boolean; code?: string }
                        | null;

                      if (!response.ok) {
                        const lockoutMessage =
                          payload?.code === 'CANNOT_DISCONNECT_LAST_LOGIN_METHOD'
                            ? "You can't disconnect your last sign-in method. Set a password first."
                            : null;
                        setMessage({
                          ok: false,
                          text:
                            lockoutMessage ??
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
                  className={`h-10 px-3 ${NEUTRAL_FOCUS_RING_CLASSES}`}
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
                {disconnectDisabledReason ? (
                  <p className="max-w-[16rem] text-right text-xs text-amber-800 dark:text-amber-200">
                    {disconnectDisabledReason}
                  </p>
                ) : null}
              </div>
            ) : (
              <Button
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
              </Button>
            )}
          </div>
        );
      })}
      {isOAuthOnly ? (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          OAuth-only account. Add a password before removing your last linked provider.
        </p>
      ) : null}
      {signInMethodsCount <= 0 ? (
        <p className="text-xs text-rose-700 dark:text-rose-300">
          No sign-in method is available. Contact support.
        </p>
      ) : null}
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
