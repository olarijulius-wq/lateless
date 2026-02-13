import { NextRequest, NextResponse } from 'next/server';
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

export const runtime = 'nodejs';

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
  const body = (await request.json().catch(() => null)) as
    | {
        companyName?: unknown;
        address?: unknown;
        vatNumber?: unknown;
        vatOrRegNumber?: unknown;
        companyEmail?: unknown;
        invoiceFooter?: unknown;
      }
    | null;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner' && context.userRole !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Only owners or admins can edit company profile.' },
        { status: 403 },
      );
    }

    const incomingVat =
      typeof body?.vatNumber === 'string'
        ? body.vatNumber
        : typeof body?.vatOrRegNumber === 'string'
          ? body.vatOrRegNumber
          : '';
    const normalizedVatNumber = normalizeVat(incomingVat);

    const profile = await upsertCompanyProfileForWorkspace({
      workspaceId: context.workspaceId,
      companyName: body?.companyName,
      address: body?.address,
      vatNumber: normalizedVatNumber,
      companyEmail: body?.companyEmail,
      invoiceFooter: body?.invoiceFooter,
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
