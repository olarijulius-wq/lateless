import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';
import { fetchUsageVerify, normalizeUsageInvoiceMetric } from '@/app/lib/usage';
import {
  enforceRateLimit,
  parseQuery,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';
const usageVerifyQuerySchema = z
  .object({
    metric: z.string().trim().optional(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'usage_verify',
        windowSec: 300,
        ipLimit: 30,
        userLimit: 12,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;
    const parsedQuery = parseQuery(usageVerifyQuerySchema, new URL(request.url));
    if (!parsedQuery.ok) return parsedQuery.response;
    const metric = normalizeUsageInvoiceMetric(parsedQuery.data.metric ?? null);

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
