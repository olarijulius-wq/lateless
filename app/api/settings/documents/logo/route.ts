import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
import {
  enforceRateLimit,
  parseJsonBody,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

const migrationMessage =
  'Documents requires DB migrations 007_add_workspaces_and_team.sql and 010_add_documents_settings.sql. Run migrations and retry.';
const uploadLogoBodySchema = z
  .object({
    dataUrl: z.unknown().optional(),
    filename: z.unknown().optional(),
    contentType: z.unknown().optional(),
    sizeBytes: z.unknown().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonBody(request, uploadLogoBodySchema, {
    maxBytes: 1024 * 1024,
  });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can upload a logo.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'documents_logo_upload',
        windowSec: 300,
        ipLimit: 10,
        userLimit: 6,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

    await setWorkspaceLogo(context.workspaceId, {
      dataUrl: body.dataUrl,
      filename: body.filename,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
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

export async function DELETE(request: NextRequest) {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can remove a logo.' },
        { status: 403 },
      );
    }

    const rl = await enforceRateLimit(
      request,
      {
        bucket: 'documents_logo_delete',
        windowSec: 300,
        ipLimit: 20,
        userLimit: 10,
      },
      { userKey: context.userEmail },
    );
    if (rl) return rl;

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
