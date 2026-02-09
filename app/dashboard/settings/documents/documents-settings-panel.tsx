'use client';

import Image from 'next/image';
import { useEffect, useState, useTransition } from 'react';
import { Button, secondaryButtonClasses } from '@/app/ui/button';

type UserRole = 'owner' | 'admin' | 'member';

type DocumentSettings = {
  invoicePrefix: string;
  nextInvoiceNumber: number;
  numberPadding: number;
  footerNote: string;
  logoDataUrl: string | null;
};

type SettingsResponse = {
  ok: boolean;
  settings?: DocumentSettings;
  userRole?: UserRole;
  canEdit?: boolean;
  code?: string;
  message?: string;
};

const defaultSettings: DocumentSettings = {
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1,
  numberPadding: 4,
  footerNote: '',
  logoDataUrl: null,
};

export default function DocumentsSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<DocumentSettings>(defaultSettings);
  const [userRole, setUserRole] = useState<UserRole>('member');
  const [canEdit, setCanEdit] = useState(false);
  const [migrationWarning, setMigrationWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadSettings() {
    const response = await fetch('/api/settings/documents', { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as
      | SettingsResponse
      | null;

    if (!response.ok || !payload?.ok || !payload.settings || !payload.userRole) {
      if (payload?.code === 'DOCUMENTS_MIGRATION_REQUIRED') {
        setMigrationWarning(payload.message ?? 'Run migration 010_add_documents_settings.sql and retry.');
      } else {
        setMessage({
          ok: false,
          text: payload?.message ?? 'Failed to load document settings.',
        });
      }
      setLoading(false);
      return;
    }

    setSettings(payload.settings);
    setUserRole(payload.userRole);
    setCanEdit(Boolean(payload.canEdit));
    setMigrationWarning(null);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setMessage(null);
      if (!active) return;
      await loadSettings();
    }

    run();

    return () => {
      active = false;
    };
  }, []);

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    setMessage(null);
    startTransition(async () => {
      const response = await fetch('/api/settings/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoicePrefix: settings.invoicePrefix,
          nextInvoiceNumber: settings.nextInvoiceNumber,
          numberPadding: settings.numberPadding,
          footerNote: settings.footerNote,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; settings?: DocumentSettings }
        | null;

      if (!response.ok || !payload?.ok || !payload.settings) {
        setMessage({
          ok: false,
          text: payload?.message ?? 'Failed to save settings.',
        });
        return;
      }

      setSettings(payload.settings);
      setMessage({ ok: true, text: 'Document settings saved.' });
    });
  }

  function onLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !canEdit) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setMessage({ ok: false, text: 'Logo must be PNG or JPEG.' });
      return;
    }

    if (file.size > 250 * 1024) {
      setMessage({ ok: false, text: 'Logo must be 250KB or smaller.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        setMessage({ ok: false, text: 'Failed to read selected logo.' });
        return;
      }

      setMessage(null);
      startTransition(async () => {
        const response = await fetch('/api/settings/documents/logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            dataUrl,
            sizeBytes: file.size,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; message?: string }
          | null;

        if (!response.ok || !payload?.ok) {
          setMessage({
            ok: false,
            text: payload?.message ?? 'Failed to upload logo.',
          });
          return;
        }

        setMessage({ ok: true, text: 'Logo uploaded.' });
        await loadSettings();
      });
    };
    reader.readAsDataURL(file);
  }

  function onRemoveLogo() {
    if (!canEdit) return;

    setMessage(null);
    startTransition(async () => {
      const response = await fetch('/api/settings/documents/logo', {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setMessage({
          ok: false,
          text: payload?.message ?? 'Failed to remove logo.',
        });
        return;
      }

      setMessage({ ok: true, text: 'Logo removed.' });
      await loadSettings();
    });
  }

  function onDownloadSamplePdf() {
    window.location.href = '/api/settings/documents/sample-pdf';
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Documents
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Loading settings...</p>
      </div>
    );
  }

  if (migrationWarning) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-amber-500/40 dark:bg-amber-500/10 dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
          Documents requires database migration
        </h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-100">{migrationWarning}</p>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-100">
          Required file: <code>010_add_documents_settings.sql</code>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Documents
        </h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Document templates and storage preferences.
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-200">
            Only owners can change document settings.
          </p>
        )}
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
            Invoice prefix
          </label>
          <input
            value={settings.invoicePrefix}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                invoicePrefix: event.target.value.toUpperCase(),
              }))
            }
            disabled={!canEdit || isPending}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
            Next invoice number
          </label>
          <input
            type="number"
            min={1}
            value={settings.nextInvoiceNumber}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                nextInvoiceNumber: Number(event.target.value) || 1,
              }))
            }
            disabled={!canEdit || isPending}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
            Number padding
          </label>
          <select
            value={settings.numberPadding}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                numberPadding: Number(event.target.value),
              }))
            }
            disabled={!canEdit || isPending}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {[2, 3, 4, 5, 6, 7, 8].map((padding) => (
              <option key={padding} value={padding}>
                {padding}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section>
        <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
          Footer note
        </label>
        <textarea
          value={settings.footerNote}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, footerNote: event.target.value }))
          }
          rows={4}
          maxLength={500}
          disabled={!canEdit || isPending}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="Optional note shown at the bottom of invoices."
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Logo</h3>

        {settings.logoDataUrl ? (
          <Image
            src={settings.logoDataUrl}
            alt="Workspace logo"
            width={160}
            height={64}
            unoptimized
            className="h-16 w-auto rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-slate-950"
          />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">No logo uploaded.</p>
        )}

        <div className="flex flex-wrap gap-3">
          <label className={`${secondaryButtonClasses} cursor-pointer ${!canEdit || isPending ? 'pointer-events-none opacity-60' : ''}`}>
            Upload logo
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              disabled={!canEdit || isPending}
              onChange={onLogoUpload}
            />
          </label>

          <button
            type="button"
            onClick={onRemoveLogo}
            disabled={!canEdit || isPending || !settings.logoDataUrl}
            className={`${secondaryButtonClasses} ${!canEdit || isPending || !settings.logoDataUrl ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            Remove logo
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">PNG/JPG up to 250KB.</p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!canEdit || isPending}>
          {isPending ? 'Saving...' : 'Save settings'}
        </Button>

        <button
          type="button"
          onClick={onDownloadSamplePdf}
          className={secondaryButtonClasses}
        >
          Download sample PDF
        </button>
      </section>

      {message && (
        <p
          className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
          aria-live="polite"
        >
          {message.text}
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">Current role: {userRole}</p>
    </form>
  );
}
