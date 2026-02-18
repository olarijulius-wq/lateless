'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, secondaryButtonClasses } from '@/app/ui/button';
import type { WorkspaceCompanyProfile } from '@/app/lib/company-profile';
import { normalizeVat } from '@/app/lib/vat';
import { LIGHT_SURFACE } from '@/app/ui/theme/tokens';

type CompanyProfileSettingsPanelProps = {
  initialProfile: WorkspaceCompanyProfile;
  canEdit: boolean;
  userRole: 'owner' | 'admin' | 'member';
};

export default function CompanyProfileSettingsPanel({
  initialProfile,
  canEdit,
  userRole,
}: CompanyProfileSettingsPanelProps) {
  const inputClasses =
    'h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus-visible:ring-neutral-200/60 dark:focus-visible:ring-offset-black';
  const textareaClasses =
    'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus-visible:ring-neutral-200/60 dark:focus-visible:ring-offset-black';
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const canonicalVatPreview = normalizeVat(profile.vatNumber);

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    setMessage(null);
    startTransition(async () => {
      const normalizedVatNumber = normalizeVat(profile.vatNumber);
      const response = await fetch('/api/settings/company-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: profile.companyName,
          address: profile.address,
          vatNumber: normalizedVatNumber,
          companyEmail: profile.companyEmail,
          invoiceFooter: profile.invoiceFooter,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; profile?: WorkspaceCompanyProfile }
        | null;

      if (!response.ok || !payload?.ok || !payload.profile) {
        setMessage({
          ok: false,
          text: payload?.message ?? 'Failed to save company profile.',
        });
        return;
      }

      setProfile(payload.profile);
      setMessage({ ok: true, text: 'Company profile saved.' });
      router.refresh();
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
        setProfile((current) => ({ ...current, logoDataUrl: dataUrl }));
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  function onRemoveLogo() {
    if (!canEdit) return;

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
      setProfile((current) => ({ ...current, logoDataUrl: null }));
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSave}
      className="mx-auto w-full max-w-5xl space-y-5"
    >
      <header className={`rounded-2xl border p-6 ${LIGHT_SURFACE} dark:border-neutral-800 dark:bg-neutral-950/80 dark:shadow-[0_16px_34px_rgba(0,0,0,0.42)]`}>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-neutral-400">
          Settings
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Company Profile</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">
          Team-scoped company details used in invoice documents.
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-200">
            Only owners or admins can edit company profile settings.
          </p>
        )}
      </header>

      <section className={`space-y-5 rounded-2xl border p-6 ${LIGHT_SURFACE} dark:border-neutral-800 dark:bg-neutral-950/80 dark:shadow-[0_16px_34px_rgba(0,0,0,0.42)]`}>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-neutral-400">
            Company
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Business details</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-neutral-200">
              Company name
            </label>
            <input
              value={profile.companyName}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  companyName: event.target.value,
                }))
              }
              disabled={!canEdit || isPending}
              className={inputClasses}
              placeholder="Lateless Studio"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-neutral-200">
              Company address
            </label>
            <textarea
              value={profile.address}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              rows={3}
              disabled={!canEdit || isPending}
              className={textareaClasses}
              placeholder="Street, City, ZIP"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-neutral-200">
              VAT / registration no.
            </label>
            <input
              value={profile.vatNumber}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  vatNumber: event.target.value,
                }))
              }
              disabled={!canEdit || isPending}
              className={inputClasses}
              placeholder="EE123456789"
            />
            {canonicalVatPreview && (
              <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
                Combined VAT/registration preview: {canonicalVatPreview}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-neutral-200">
              Company contact email
            </label>
            <input
              type="email"
              value={profile.companyEmail}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  companyEmail: event.target.value,
                }))
              }
              disabled={!canEdit || isPending}
              className={inputClasses}
              placeholder="email@example.com"
            />
          </div>
        </div>
      </section>

      <section className={`space-y-4 rounded-2xl border p-6 ${LIGHT_SURFACE} dark:border-neutral-800 dark:bg-neutral-950/80 dark:shadow-[0_16px_34px_rgba(0,0,0,0.42)]`}>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-neutral-400">
            Branding
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Footer and logo</h3>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-neutral-200">
            Invoice footer / notes
          </label>
          <textarea
            value={profile.invoiceFooter}
            onChange={(event) =>
              setProfile((current) => ({
                ...current,
                invoiceFooter: event.target.value,
              }))
            }
            rows={4}
            maxLength={500}
            disabled={!canEdit || isPending}
            className={textareaClasses}
            placeholder="Thanks for your business."
          />
        </div>

        {profile.logoDataUrl ? (
          <Image
            src={profile.logoDataUrl}
            alt="Company logo"
            width={160}
            height={64}
            unoptimized
            className="h-16 w-auto rounded-lg border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900"
          />
        ) : (
          <p className="text-sm text-slate-500 dark:text-neutral-400">No logo uploaded.</p>
        )}

        <div className="flex flex-wrap gap-3">
          <label
            className={`${secondaryButtonClasses} cursor-pointer ${!canEdit || isPending ? 'pointer-events-none opacity-60' : ''}`}
          >
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
            disabled={!canEdit || isPending || !profile.logoDataUrl}
            className={`${secondaryButtonClasses} ${!canEdit || isPending || !profile.logoDataUrl ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            Remove logo
          </button>
        </div>
      </section>

      {message && (
        <p
          className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
          aria-live="polite"
        >
          {message.text}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canEdit || isPending}>
          {isPending ? 'Saving...' : 'Save company profile'}
        </Button>
        <p className="text-xs text-slate-500 dark:text-neutral-500">Current role: {userRole}</p>
      </div>
    </form>
  );
}
