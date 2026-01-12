// app/api/customers/export/route.ts
import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { auth } from '@/auth';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = normalizeEmail(session.user.email);

  // Kontrolli, et kasutaja on Pro
  const userRows = await sql<{ is_pro: boolean }[]>`
    select is_pro
    from public.users
    where lower(email) = ${email}
    limit 1
  `;

  const isPro = userRows[0]?.is_pro ?? false;

  if (!isPro) {
    return NextResponse.json(
      { error: 'Pro plan required to export customers CSV.' },
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
