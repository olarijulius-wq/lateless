import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
import {
  enforceRateLimit,
  parseJsonBody,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const migrationMessage =
  'Documents requires DB migrations 007_add_workspaces_and_team.sql and 010_add_documents_settings.sql. Run migrations and retry.';
const updateDocumentsBodySchema = z
  .object({
    invoicePrefix: z.unknown().optional(),
    nextInvoiceNumber: z.unknown().optional(),
    numberPadding: z.unknown().optional(),
    footerNote: z.unknown().optional(),
  })
  .strict();

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
  const parsedBody = await parseJsonBody(request, updateDocumentsBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can change document settings.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'documents_settings_update',
        windowSec: 300,
        ipLimit: 20,
        userLimit: 10,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

    const settings = await updateWorkspaceDocumentSettings(context.workspaceId, {
      invoicePrefix: body.invoicePrefix,
      nextInvoiceNumber: body.nextInvoiceNumber,
      numberPadding: body.numberPadding,
      footerNote: body.footerNote,
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
