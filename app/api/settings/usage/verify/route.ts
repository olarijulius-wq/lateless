import { NextResponse } from 'next/server';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';
import { fetchUsageVerify, normalizeUsageInvoiceMetric } from '@/app/lib/usage';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const metric = normalizeUsageInvoiceMetric(
      new URL(request.url).searchParams.get('metric'),
    );

    const verify = await fetchUsageVerify({
      workspaceId: context.workspaceId,
      userEmail: context.userEmail,
      metric,
    });

    return NextResponse.json({
      ok: true,
      ...verify,
    });
  } catch (error) {
    console.error('Usage verify failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to verify usage reconciliation.' },
      { status: 500 },
    );
  }
}
