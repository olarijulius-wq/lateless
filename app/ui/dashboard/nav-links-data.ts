import {
  UserGroupIcon,
  HomeIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ClockIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

export type DashboardNavLink = {
  name: string;
  href: string;
  icon: typeof HomeIcon;
  proOnly?: boolean;
  adminOnly?: boolean;
};

const BASE_DASHBOARD_LINKS: DashboardNavLink[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  {
    name: 'Invoices',
    href: '/dashboard/invoices',
    icon: DocumentDuplicateIcon,
  },
  { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
  { name: 'Late payers', href: '/dashboard/late-payers', icon: ClockIcon, proOnly: true },
  { name: 'Reminders', href: '/dashboard/reminders', icon: EnvelopeIcon, proOnly: true },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
];

type GetDashboardLinksInput = {
  canViewFeedbackAdmin?: boolean;
};

export function getDashboardLinks(
  input: GetDashboardLinksInput = {},
): DashboardNavLink[] {
  const links = [...BASE_DASHBOARD_LINKS];

  if (input.canViewFeedbackAdmin) {
    links.push({
      name: 'Feedback',
      href: '/dashboard/feedback',
      icon: ChatBubbleLeftRightIcon,
      adminOnly: true,
    });
  }

  return links;
}
