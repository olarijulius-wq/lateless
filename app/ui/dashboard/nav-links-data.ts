import {
  UserGroupIcon,
  HomeIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export const dashboardLinks = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  {
    name: 'Invoices',
    href: '/dashboard/invoices',
    icon: DocumentDuplicateIcon,
  },
  { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
  { name: 'Late payers', href: '/dashboard/late-payers', icon: ClockIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
];
