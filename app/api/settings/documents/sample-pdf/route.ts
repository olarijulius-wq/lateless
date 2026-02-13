export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type PDFDocumentType from 'pdfkit';
import {
  DOCUMENTS_MIGRATION_REQUIRED_CODE,
  fetchWorkspaceDocumentSettings,
  formatInvoiceNumber,
  isDocumentsMigrationRequiredError,
} from '@/app/lib/documents';
import { fetchCompanyProfileForWorkspace } from '@/app/lib/company-profile';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';

const PDFDocument = require('pdfkit/js/pdfkit.standalone') as typeof PDFDocumentType;

const migrationMessage =
  'Documents requires DB migrations 007_add_workspaces_and_team.sql and 010_add_documents_settings.sql. Run migrations and retry.';

function dataUrlToBuffer(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;

  const base64 = dataUrl.slice(commaIndex + 1);
  if (!base64) return null;

  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

async function buildSamplePdf(input: {
  invoicePrefix: string;
  nextInvoiceNumber: number;
  numberPadding: number;
  footerNote: string;
  logoDataUrl: string | null;
  companyName: string;
  address: string;
  companyEmail: string;
  vatOrRegNumber: string;
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const logoX = 50;
    const logoY = 45;
    const logoFit: [number, number] = [160, 80];

    if (input.logoDataUrl) {
      const logoBuffer = dataUrlToBuffer(input.logoDataUrl);

      if (logoBuffer) {
        const sig = logoBuffer.subarray(0, 8).toString('hex');
        console.log('[pdf-logo-sig]', sig, 'bytes', logoBuffer.length);
        try {
          const logoArrayBuffer = logoBuffer.buffer.slice(
            logoBuffer.byteOffset,
            logoBuffer.byteOffset + logoBuffer.byteLength,
          );
          doc.image(logoArrayBuffer, logoX, logoY, { fit: logoFit });
        } catch (err) {
          console.error('[pdf-logo-error]', err);
        }
      }
    }

    doc.fontSize(24).text(input.companyName || 'Sample Company', 50, 120);
    doc.fontSize(14).text('Sample Invoice', 50, 150);
    doc.moveDown();

    doc
      .fontSize(12)
      .text(`Invoice number: ${formatInvoiceNumber(input)}`)
      .moveDown(0.5)
      .text('Amount: EUR 150.00')
      .moveDown(0.5)
      .text('Date: 2026-02-09')
      .moveDown(0.5)
      .text('Customer: Sample Customer');

    if (input.address) {
      doc.moveDown(0.5).text(`Address: ${input.address}`);
    }
    if (input.vatOrRegNumber) {
      doc.moveDown(0.5).text(`VAT/Reg no: ${input.vatOrRegNumber}`);
    }
    if (input.companyEmail) {
      doc.moveDown(0.5).text(`Email: ${input.companyEmail}`);
    }

    if (input.footerNote) {
      doc.moveDown(2);
      doc.fontSize(10).fillColor('#444444').text(input.footerNote, {
        width: 500,
      });
    }

    doc.end();
  });
}

export async function GET() {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();

    if (context.userRole !== 'owner') {
      return NextResponse.json(
        { ok: false, message: 'Only owners can download sample PDF.' },
        { status: 403 },
      );
    }

    const [settings, companyProfile] = await Promise.all([
      fetchWorkspaceDocumentSettings(context.workspaceId),
      fetchCompanyProfileForWorkspace(context.workspaceId),
    ]);
    const pdfBuffer = await buildSamplePdf({
      ...settings,
      companyName: companyProfile.companyName,
      address: companyProfile.address,
      companyEmail: companyProfile.companyEmail,
      vatOrRegNumber: companyProfile.vatOrRegNumber,
      footerNote: companyProfile.invoiceFooter,
      logoDataUrl: companyProfile.logoDataUrl,
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="sample-invoice.pdf"',
        'Cache-Control': 'no-store, max-age=0',
      },
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

    console.error('Sample PDF generation failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to generate sample PDF.' },
      { status: 500 },
    );
  }
}
