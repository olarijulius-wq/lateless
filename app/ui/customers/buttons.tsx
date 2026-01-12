import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { deleteCustomer } from '@/app/lib/actions';

export function UpdateCustomer({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/customers/${id}/edit`}
      className="rounded-md border border-slate-800 p-2 text-slate-200 transition hover:border-sky-400/60 hover:bg-slate-800/80"
    >
      <PencilIcon className="w-5" />
    </Link>
  );
}

export function DeleteCustomer({ id }: { id: string }) {
  const deleteCustomerWithId = deleteCustomer.bind(null, id);
  return (
    <form action={deleteCustomerWithId}>
      <button
        type="submit"
        className="rounded-md border border-slate-800 p-2 text-slate-200 transition hover:border-rose-400/60 hover:bg-slate-800/80 hover:text-rose-200"
      >
        <span className="sr-only">Delete</span>
        <TrashIcon className="w-5" />
      </button>
    </form>
  );
}
