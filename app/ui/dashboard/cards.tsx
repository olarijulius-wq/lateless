import { fetchCardData } from '@/app/lib/data';
import CardsClient from '@/app/ui/dashboard/cards-client';

export default async function CardWrapper() {
  const {
    numberOfInvoices,
    numberOfCustomers,
    totalPaidInvoices,
    totalPendingInvoices,
  } = await fetchCardData();

  return (
    <CardsClient
      numberOfInvoices={numberOfInvoices}
      numberOfCustomers={numberOfCustomers}
      totalPaidInvoices={totalPaidInvoices}
      totalPendingInvoices={totalPendingInvoices}
    />
  );
}
