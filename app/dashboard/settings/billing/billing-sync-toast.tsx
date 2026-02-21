'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type BillingSyncToastProps = {
  enabled: boolean;
  sessionId: string | null;
};

type SyncState = 'idle' | 'synced' | 'failed';

export default function BillingSyncToast({ enabled, sessionId }: BillingSyncToastProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<SyncState>('idle');

  const shouldRun = enabled && typeof sessionId === 'string' && sessionId.length > 0;

  useEffect(() => {
    if (!shouldRun || state !== 'idle') {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch('/api/stripe/reconcile', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const payload = (await res.json()) as { ok?: boolean };
        if (cancelled) return;

        if (res.ok && payload?.ok) {
          setState('synced');
          router.refresh();
          return;
        }

        setState('failed');
      } catch {
        if (!cancelled) {
          setState('failed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, sessionId, shouldRun, state]);

  useEffect(() => {
    if (state !== 'synced' && state !== 'failed') {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete('success');
      params.delete('session_id');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pathname, router, state]);

  const message = useMemo(() => {
    if (state === 'synced') return 'Plan synced.';
    if (state === 'failed') return 'Payment confirmed. Plan sync pending.';
    return null;
  }, [state]);

  if (!message || !enabled) return null;

  return (
    <div className="fixed right-4 top-4 z-50 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-[0_14px_28px_rgba(15,23,42,0.14)] dark:border-neutral-700 dark:bg-black dark:text-zinc-100">
      {message}
    </div>
  );
}
