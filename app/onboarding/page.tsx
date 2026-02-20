import { redirect } from 'next/navigation';

export default function LegacyOnboardingRedirectPage() {
  redirect('/dashboard/onboarding');
}
