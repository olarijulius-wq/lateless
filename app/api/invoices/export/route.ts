// app/api/invoices/export/route.ts
import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/auth';
import { PLAN_CONFIG, resolveEffectivePlan } from '@/app/lib/config';
import { enforceRateLimit } from '@/app/lib/security/api-guard';

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

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = normalizeEmail(session.user.email);

  const rl = await enforceRateLimit(req, {
    bucket: 'invoice_export',
    windowSec: 300,
    ipLimit: 10,
    userLimit: 5,
  }, { userKey: email });
  if (rl) return rl;

  const userRows = await sql<
    { plan: string | null; subscription_status: string | null }[]
  >`
    select plan, subscription_status
    from public.users
    where lower(email) = ${email}
    limit 1
  `;

  const effectivePlan = resolveEffectivePlan(
    userRows[0]?.plan ?? null,
    userRows[0]?.subscription_status ?? null,
  );
  const planConfig = PLAN_CONFIG[effectivePlan];

  if (!planConfig.canExportCsv) {
    return NextResponse.json(
      {
        error: 'PLAN_REQUIRED',
        message:
          'CSV export is available on Solo, Pro, and Studio. Upgrade your plan in Settings.',
        requiredPlan: 'solo',
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
