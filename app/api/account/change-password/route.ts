import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import { z } from 'zod';
import { requireUserEmail } from '@/app/lib/data';
import { enforceRateLimit, parseJsonBody } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmNewPassword: z.string().min(1),
  })
  .strict();

export async function POST(request: NextRequest) {
  let userEmail = '';

  try {
    userEmail = await requireUserEmail();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized.' },
      { status: 401 },
    );
  }

  try {
    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'account_change_password',
        windowSec: 300,
        ipLimit: 20,
        userLimit: 10,
      },
      { userKey: userEmail },
    );
    if (rl) return rl;

    const parsedBody = await parseJsonBody(request, changePasswordBodySchema);
    if (!parsedBody.ok) return parsedBody.response;

    const { currentPassword, newPassword, confirmNewPassword } = parsedBody.data;

    if (newPassword !== confirmNewPassword) {
      return NextResponse.json(
        { ok: false, message: 'New password confirmation does not match.' },
        { status: 400 },
      );
    }

    const normalizedEmail = normalizeEmail(userEmail);
    const [user] = await sql<{ id: string; password: string | null }[]>`
      select id, password
      from users
      where lower(email) = ${normalizedEmail}
      limit 1
    `;

    if (!user?.password) {
      return NextResponse.json(
        { ok: false, message: 'Account password is not available for this login method.' },
        { status: 400 },
      );
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return NextResponse.json(
        { ok: false, message: 'Current password is incorrect.' },
        { status: 400 },
      );
    }

    const nextHash = await bcrypt.hash(newPassword, 10);
    await sql`
      update users
      set password = ${nextHash}
      where id = ${user.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Change password failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to change password.' },
      { status: 500 },
    );
  }
}
