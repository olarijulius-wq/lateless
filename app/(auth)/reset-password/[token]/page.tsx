import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from '@/app/lib/db';
import AuthLayout from '@/app/(auth)/_components/auth-layout';
import ResetPasswordForm from './reset-password-form';
import { secondaryButtonClasses } from '@/app/ui/button';

export const metadata: Metadata = {
  title: 'Reset password',
};

type ResetPasswordPageProps = {
  params: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage(props: ResetPasswordPageProps) {
  const params = await props.params;
  const token = params?.token?.trim() ?? '';

  let isValidLink = false;

  if (token) {
    const [user] = await sql<{ id: string }[]>`
      select id
      from users
      where password_reset_token = ${token}
        and password_reset_sent_at is not null
        and password_reset_sent_at >= now() - interval '1 hour'
      limit 1
    `;
    isValidLink = Boolean(user);
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a new password for your account."
      maxWidthClassName="max-w-lg"
    >
      {!isValidLink ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-amber-500/30 bg-amber-400/12 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            This link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className={`${secondaryButtonClasses} h-11 w-full justify-center`}
          >
            Request a new reset link
          </Link>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </AuthLayout>
  );
}
