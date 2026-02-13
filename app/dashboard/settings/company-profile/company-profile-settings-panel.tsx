'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, secondaryButtonClasses } from '@/app/ui/button';
import {
  SETTINGS_INPUT_CLASSES,
  SETTINGS_TEXTAREA_CLASSES,
} from '@/app/ui/form-control';
import type { WorkspaceCompanyProfile } from '@/app/lib/company-profile';

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
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    setMessage(null);
    startTransition(async () => {
      const response = await fetch('/api/settings/company-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
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
      className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Company Profile
        </h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Team-scoped company data used by invoice PDFs and sample PDF.
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-200">
            Only owners or admins can edit company profile settings.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
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
            className={SETTINGS_INPUT_CLASSES}
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
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
            className={SETTINGS_TEXTAREA_CLASSES}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
            VAT / registration no.
          </label>
          <input
            value={profile.vatOrRegNumber}
            onChange={(event) =>
              setProfile((current) => ({
                ...current,
                vatOrRegNumber: event.target.value,
              }))
            }
            disabled={!canEdit || isPending}
            className={SETTINGS_INPUT_CLASSES}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
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
            className={SETTINGS_INPUT_CLASSES}
          />
        </div>
      </div>

      <section>
        <label className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100">
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
          className={SETTINGS_TEXTAREA_CLASSES}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Logo</h3>
        {profile.logoDataUrl ? (
          <Image
            src={profile.logoDataUrl}
            alt="Company logo"
            width={160}
            height={64}
            unoptimized
            className="h-16 w-auto rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-slate-950"
          />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">No logo uploaded.</p>
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
        <p className="text-xs text-slate-500 dark:text-slate-400">Current role: {userRole}</p>
      </div>
    </form>
  );
}
