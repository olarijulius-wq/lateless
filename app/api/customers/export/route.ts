// app/api/customers/export/route.ts
import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/auth';
import { PLAN_CONFIG, resolveEffectivePlan } from '@/app/lib/config';
import { enforceRateLimit } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = normalizeEmail(session.user.email);

  const rl = await enforceRateLimit(req, {
    bucket: 'customers_export',
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

  // Tõmba kõik customers, mis kuuluvad sellele user’ile
  const rows = await sql<
    { id: string; name: string; email: string | null }[]
  >`
    select id, name, email
    from public.customers
    where lower(user_email) = ${email}
    order by name asc
  `;

  // Ehita CSV
  const header = ['id', 'name', 'email'];
  const escape = (value: unknown) => {
    const str = value == null ? '' : String(value);
    // Topeltjutumärgid escape’iks
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const lines = [
    header.join(','), // header
    ...rows.map((row) =>
      [
        escape(row.id),
        escape(row.name),
        escape(row.email ?? ''),
      ].join(','),
    ),
  ];

  const csv = lines.join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="customers.csv"',
    },
  });
}
