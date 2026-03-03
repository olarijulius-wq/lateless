import { redirect } from 'next/navigation';

export default function DashboardSetupRedirectPage() {
  redirect('/dashboard/onboarding');
}
