import { NextRequest, NextResponse } from 'next/server';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';
import {
  DOCUMENTS_MIGRATION_REQUIRED_CODE,
  fetchWorkspaceDocumentSettings,
  isDocumentsMigrationRequiredError,
  updateWorkspaceDocumentSettings,
} from '@/app/lib/documents';

export const runtime = 'nodejs';

const migrationMessage =
  'Documents requires DB migrations 007_add_workspaces_and_team.sql and 010_add_documents_settings.sql. Run migrations and retry.';

export async function GET() {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const settings = await fetchWorkspaceDocumentSettings(context.workspaceId);

    return NextResponse.json({
      ok: true,
      settings,
      userRole: context.userRole,
      canEdit: context.userRole === 'owner',
    });
  } catch (error) {
    if (isTeamMigrationRequiredError(error) || isDocumentsMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: DOCUMENTS_MIGRATION_REQUIRED_CODE,
          message: migrationMessage,
        },
        { status: 503 },
      );
    }

    console.error('Load documents settings failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to load documents settings.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can change document settings.' },
        { status: 403 },
      );
    }

    const settings = await updateWorkspaceDocumentSettings(context.workspaceId, {
      invoicePrefix: (body as { invoicePrefix?: unknown }).invoicePrefix,
      nextInvoiceNumber: (body as { nextInvoiceNumber?: unknown }).nextInvoiceNumber,
      numberPadding: (body as { numberPadding?: unknown }).numberPadding,
      footerNote: (body as { footerNote?: unknown }).footerNote,
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (isTeamMigrationRequiredError(error) || isDocumentsMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: DOCUMENTS_MIGRATION_REQUIRED_CODE,
          message: migrationMessage,
        },
        { status: 503 },
      );
    }

    if (error instanceof Error) {
      const validationFields = new Set([
        'invoicePrefix',
        'nextInvoiceNumber',
        'numberPadding',
        'footerNote',
      ]);

      if (validationFields.has(error.message)) {
        return NextResponse.json(
          { ok: false, message: `Invalid field: ${error.message}` },
          { status: 400 },
        );
      }
    }

    console.error('Save document settings failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to save document settings.' },
      { status: 500 },
    );
  }
}
