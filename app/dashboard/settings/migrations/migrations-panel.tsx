'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/app/ui/button';

type MigrationsPanelProps = {
  lastApplied: { filename: string; appliedAt: string } | null;
  pending: number;
  pendingFilenames: string[];
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function MigrationsPanel({
  lastApplied,
  pending,
  pendingFilenames,
}: MigrationsPanelProps) {
  const [note, setNote] = useState<string | null>(null);

  const report = useMemo(
    () => ({
      lastApplied,
      pending,
      pendingFilenames,
    }),
    [lastApplied, pending, pendingFilenames],
  );

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setNote('Report copied.');
    } catch {
      setNote('Copy failed.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Last applied
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
            {lastApplied?.filename ?? 'None'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {formatDate(lastApplied?.appliedAt ?? null)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Pending migrations
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{pending}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Read-only report. Run migrations from CLI only.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-700 dark:text-slate-300">Pending filenames</p>
        {pendingFilenames.length > 0 ? (
          <ul className="max-h-56 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-slate-700 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-slate-300">
            {pendingFilenames.map((filename) => (
              <li key={filename}>{filename}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">No pending migrations.</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={copyReport}>
          Copy report
        </Button>
        {note ? <p className="text-sm text-slate-600 dark:text-slate-400">{note}</p> : null}
      </div>
    </div>
  );
}
