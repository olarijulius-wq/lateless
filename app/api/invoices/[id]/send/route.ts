import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/auth';
import { canPayInvoiceStatus } from '@/app/lib/invoice-status';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';
import { sendInvoiceEmail } from '@/app/lib/invoice-email';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeReturnTo(value: string | null) {
  if (!value) return '/dashboard/invoices';
  if (!value.startsWith('/dashboard/invoices')) return '/dashboard/invoices';
  return value;
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const params = await props.params;
  const userEmail = normalizeEmail(session.user.email);
  const returnTo = sanitizeReturnTo(new URL(req.url).searchParams.get('returnTo'));

  const [invoice] = await sql<{
    id: string;
    amount: number;
    due_date: string | null;
    status: string;
    invoice_number: string | null;
    customer_id: string;
    customer_name: string;
    customer_email: string | null;
    user_email: string;
  }[]>`
    select
      i.id,
      i.amount,
      i.due_date,
      i.status,
      i.invoice_number,
      i.user_email,
      c.id as customer_id,
      c.name as customer_name,
      c.email as customer_email
    from public.invoices i
    join public.customers c
      on c.id = i.customer_id
    where i.id = ${params.id}
      and lower(i.user_email) = ${userEmail}
    limit 1
  `;

  if (!invoice) {
    return NextResponse.json({ ok: false, error: 'Invoice not found.' }, { status: 404 });
  }

  if (!invoice.customer_email?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        code: 'CUSTOMER_EMAIL_MISSING',
        error: 'Customer email is required before sending.',
        actionUrl: `/dashboard/customers/${invoice.customer_id}/edit?returnTo=${encodeURIComponent(returnTo)}`,
      },
      { status: 409 },
    );
  }

  if (!canPayInvoiceStatus(invoice.status)) {
    return NextResponse.json(
      {
        ok: false,
        code: 'INVOICE_NOT_SENDABLE',
        error: `Invoice with status "${invoice.status}" cannot be sent.`,
      },
      { status: 409 },
    );
  }

  try {
    const workspaceContext = await ensureWorkspaceContextForCurrentUser();
    if (workspaceContext.userRole !== 'owner' && workspaceContext.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, code: 'FORBIDDEN', error: 'Only owners or admins can send invoices.' },
        { status: 403 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000');

    const sent = await sendInvoiceEmail({
      workspaceId: workspaceContext.workspaceId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amount: invoice.amount,
      dueDate: invoice.due_date,
      customerName: invoice.customer_name,
      customerEmail: invoice.customer_email.trim(),
      userEmail,
      baseUrl,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${invoice.id}`);

    return NextResponse.json({
      ok: true,
      sentAt: sent.sentAt,
      provider: sent.provider,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Failed to send invoice email.';
    return NextResponse.json(
      {
        ok: false,
        code: 'INVOICE_SEND_FAILED',
        error: message,
        actionHint: 'Check email provider settings in Settings -> SMTP.',
      },
      { status: 500 },
    );
  }
}
