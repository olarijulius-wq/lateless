import { NextRequest, NextResponse } from 'next/server';
import {
  clearWorkspaceLogo,
  DOCUMENTS_MIGRATION_REQUIRED_CODE,
  isDocumentsMigrationRequiredError,
  setWorkspaceLogo,
} from '@/app/lib/documents';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';

export const runtime = 'nodejs';

const migrationMessage =
  'Documents requires DB migrations 007_add_workspaces_and_team.sql and 010_add_documents_settings.sql. Run migrations and retry.';

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
        { ok: false, message: 'Only owners can upload a logo.' },
        { status: 403 },
      );
    }

    await setWorkspaceLogo(context.workspaceId, {
      dataUrl: (body as { dataUrl?: unknown }).dataUrl,
      filename: (body as { filename?: unknown }).filename,
      contentType: (body as { contentType?: unknown }).contentType,
      sizeBytes: (body as { sizeBytes?: unknown }).sizeBytes,
    });

    return NextResponse.json({ ok: true });
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
        'logoDataUrl',
        'logoFilename',
        'logoContentType',
        'logoSize',
      ]);

      if (validationFields.has(error.message)) {
        return NextResponse.json(
          { ok: false, message: `Invalid field: ${error.message}` },
          { status: 400 },
        );
      }
    }

    console.error('Upload logo failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to upload logo.' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can remove a logo.' },
        { status: 403 },
      );
    }

    await clearWorkspaceLogo(context.workspaceId);
    return NextResponse.json({ ok: true });
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

    console.error('Remove logo failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to remove logo.' },
      { status: 500 },
    );
  }
}
