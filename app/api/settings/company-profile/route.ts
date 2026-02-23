import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  fetchCompanyProfileForWorkspace,
  upsertCompanyProfileForWorkspace,
} from '@/app/lib/company-profile';
import { normalizeVat } from '@/app/lib/vat';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import {
  emailSchema,
  enforceRateLimit,
  parseJsonBody,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const companyProfileBodySchema = z
  .object({
    companyName: z.string().trim().max(200).optional(),
    address: z.string().trim().max(4000).optional(),
    vatNumber: z.string().trim().max(50).optional(),
    vatOrRegNumber: z.string().trim().max(50).optional(),
    companyEmail: emailSchema.optional(),
    invoiceFooter: z.string().trim().max(2000).optional(),
  })
  .strict();

export async function GET() {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const profile = await fetchCompanyProfileForWorkspace(context.workspaceId);

    return NextResponse.json({
      ok: true,
      profile,
      userRole: context.userRole,
      canEdit: context.userRole === 'owner' || context.userRole === 'admin',
    });
  } catch (error) {
    if (isTeamMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: TEAM_MIGRATION_REQUIRED_CODE,
          message:
            'Team requires DB migrations 007_add_workspaces_and_team.sql and 013_add_active_workspace_and_company_profile_workspace_scope.sql. Run migrations and retry.',
        },
        { status: 503 },
      );
    }

    console.error('Load company profile failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to load company profile.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only owners or admins can edit company profile.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'settings_company_profile',
        windowSec: 60,
        ipLimit: 30,
        userLimit: 15,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

    const parsedBody = await parseJsonBody(request, companyProfileBodySchema);
    if (!parsedBody.ok) return parsedBody.response;

    const body = parsedBody.data;

    const incomingVat = body.vatNumber ?? body.vatOrRegNumber ?? '';
    const normalizedVatNumber = normalizeVat(incomingVat);

    const profile = await upsertCompanyProfileForWorkspace({
      workspaceId: context.workspaceId,
      companyName: body.companyName,
      address: body.address,
      vatNumber: normalizedVatNumber,
      companyEmail: body.companyEmail,
      invoiceFooter: body.invoiceFooter,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if (isTeamMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: TEAM_MIGRATION_REQUIRED_CODE,
          message:
            'Team requires DB migrations 007_add_workspaces_and_team.sql and 013_add_active_workspace_and_company_profile_workspace_scope.sql. Run migrations and retry.',
        },
        { status: 503 },
      );
    }

    if (error instanceof Error) {
      const validationFields = new Set([
        'companyName',
        'companyEmail',
      ]);
      if (validationFields.has(error.message)) {
        return NextResponse.json(
          { ok: false, message: `Invalid field: ${error.message}` },
          { status: 400 },
        );
      }
    }

    console.error('Save company profile failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to save company profile.' },
      { status: 500 },
    );
  }
}
