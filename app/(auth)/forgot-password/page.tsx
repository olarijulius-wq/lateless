import type { Metadata } from 'next';
import AuthLayout from '@/app/(auth)/_components/auth-layout';
import ForgotPasswordForm from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot password',
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send a password reset link."
      maxWidthClassName="max-w-lg"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
