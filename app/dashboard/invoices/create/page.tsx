import Form from '@/app/ui/invoices/create-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { fetchCustomers } from '@/app/lib/data';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create',
};
 
 
export default async function Page(props: {
  searchParams?: Promise<{ customerId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const customers = await fetchCustomers();
  const initialCustomerId = searchParams?.customerId ?? null;
 
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          {
            label: 'Create Invoice',
            href: '/dashboard/invoices/create',
            active: true,
          },
        ]}
      />
      <Form customers={customers} initialCustomerId={initialCustomerId} />
    </main>
  );
}
