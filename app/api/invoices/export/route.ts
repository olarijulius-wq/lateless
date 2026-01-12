// app/api/invoices/export/route.ts
import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/auth';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Väike abifunktsioon CSV jaoks – escapib jutumärgid jms
function toCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // kui on koma, jutumärk või reavahetus – pane tsitaatidesse
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = normalizeEmail(session.user.email);

  // kontrolli, kas kasutaja on PRO
  const userRows = await sql<{ is_pro: boolean }[]>`
    select is_pro
    from public.users
    where lower(email) = ${email}
    limit 1
  `;

  const isPro = userRows[0]?.is_pro ?? false;

  if (!isPro) {
    return NextResponse.json(
      {
        error:
          'Only Pro users can export invoices as CSV. Upgrade your plan in Settings.',
      },
      { status: 403 },
    );
  }

  // Tõmbame kõik Sinu arved + customer info
  const rows = await sql<
    {
      id: string;
      date: string;
      amount: number;
      status: string;
      customer_name: string;
      customer_email: string;
    }[]
  >`
    select
      invoices.id,
      invoices.date,
      invoices.amount,
      invoices.status,
      customers.name  as customer_name,
      customers.email as customer_email
    from public.invoices
    join public.customers
      on invoices.customer_id = customers.id
     and lower(invoices.user_email) = lower(customers.user_email)
    where lower(invoices.user_email) = ${email}
    order by invoices.date desc
  `;

  // Header rida
  const header = [
    'invoice_id',
    'date',
    'customer_name',
    'customer_email',
    'status',
    'amount',
  ];

  const lines = [header.map(toCsvValue).join(',')];

  for (const row of rows) {
    const dollars = (row.amount ?? 0) / 100;
    const line = [
      row.id,
      row.date,
      row.customer_name,
      row.customer_email,
      row.status,
      dollars.toFixed(2),
    ].map(toCsvValue);

    lines.push(line.join(','));
  }

  const csv = lines.join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="invoices.csv"',
    },
  });
}
