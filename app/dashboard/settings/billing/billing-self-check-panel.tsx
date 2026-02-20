'use client';

import { useMemo, useState } from 'react';
import { Button, secondaryButtonClasses } from '@/app/ui/button';

type SelfCheckLatestWebhook = {
  eventId: string;
  eventType: string;
  status: string;
  processedAt: string | null;
  receivedAt: string;
  error: string | null;
} | null;

type SelfCheckSnapshot = {
  environment: string;
  keyMode: string;
  keySuffix: string;
  connectAccountId: string | null;
  latestWebhook: SelfCheckLatestWebhook;
};

type SelfCheckResult = {
  ok: boolean;
  result?: 'PASS' | 'FAIL';
  reason?: string;
  nextStep?: string;
};

function formatTime(value: string | null | undefined) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function BillingSelfCheckPanel({
  initialSnapshot,
}: {
  initialSnapshot: SelfCheckSnapshot;
}) {
  const [snapshot, setSnapshot] = useState<SelfCheckSnapshot>(initialSnapshot);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SelfCheckResult | null>(null);

  const latestWebhookSummary = useMemo(() => {
    if (!snapshot.latestWebhook) return 'No webhook events yet.';
    const processed = formatTime(snapshot.latestWebhook.processedAt);
    return `${snapshot.latestWebhook.status} (${snapshot.latestWebhook.eventType}) at ${processed}`;
  }, [snapshot.latestWebhook]);

  async function runSelfCheck() {
    setRunning(true);
    setResult(null);

    try {
      const [runRes, snapshotRes] = await Promise.all([
        fetch('/api/settings/billing/self-check', { method: 'POST' }),
        fetch('/api/settings/billing/self-check', { method: 'GET' }),
      ]);
      const runPayload = (await runRes.json().catch(() => null)) as SelfCheckResult | null;
      const snapshotPayload = (await snapshotRes.json().catch(() => null)) as
        | ({ ok?: boolean } & Partial<SelfCheckSnapshot>)
        | null;

      if (snapshotRes.ok && snapshotPayload?.ok) {
        setSnapshot((current) => ({
          ...current,
          environment: snapshotPayload.environment ?? current.environment,
          keyMode: snapshotPayload.keyMode ?? current.keyMode,
          keySuffix: snapshotPayload.keySuffix ?? current.keySuffix,
          connectAccountId:
            typeof snapshotPayload.connectAccountId === 'string' ||
            snapshotPayload.connectAccountId === null
              ? snapshotPayload.connectAccountId
              : current.connectAccountId,
          latestWebhook: snapshotPayload.latestWebhook ?? current.latestWebhook,
        }));
      }

      if (!runRes.ok) {
        setResult({
          ok: false,
          result: 'FAIL',
          reason: runPayload?.reason ?? 'Self-check failed.',
          nextStep: runPayload?.nextStep ?? 'Check Stripe key and Connect account setup.',
        });
        return;
      }

      setResult({
        ok: true,
        result: runPayload?.result ?? 'PASS',
        reason: runPayload?.reason ?? 'Stripe checks passed.',
        nextStep: runPayload?.nextStep ?? 'No action required.',
      });
    } catch {
      setResult({
        ok: false,
        result: 'FAIL',
        reason: 'Self-check request failed.',
        nextStep: 'Retry. If this persists, inspect server logs.',
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Billing self-check</h3>
      <div className="grid gap-2 text-sm text-slate-700 dark:text-neutral-300">
        <p>
          Environment: <span className="font-medium">{snapshot.environment}</span>
        </p>
        <p>
          Stripe key mode: <span className="font-medium">{snapshot.keyMode}</span>
        </p>
        <p>
          Key suffix: <span className="font-medium">{snapshot.keySuffix}</span>
        </p>
        <p>
          Connect account: <span className="font-medium">{snapshot.connectAccountId ?? 'not connected'}</span>
        </p>
        <p>
          Last webhook: <span className="font-medium">{latestWebhookSummary}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={runSelfCheck} aria-disabled={running}>
          {running ? 'Running…' : 'Run self-check'}
        </Button>
        <button
          type="button"
          onClick={runSelfCheck}
          className={`${secondaryButtonClasses} h-9 px-3`}
        >
          Refresh
        </button>
      </div>

      {result ? (
        <div
          className={`rounded-xl border p-3 text-sm ${
            result.ok
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-200'
          }`}
        >
          <p className="font-semibold">
            {result.result ?? (result.ok ? 'PASS' : 'FAIL')}
          </p>
          {result.reason ? <p className="mt-1">{result.reason}</p> : null}
          {result.nextStep ? <p className="mt-1">Next step: {result.nextStep}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
