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
const LOGO_MAX_W = 160;
const LOGO_MAX_H = 48;
const HEADER_MIN_H = 72;
const HEADER_TOP_Y = 45;
const HEADER_TOP_PADDING = 12;
const HEADER_BOTTOM_PADDING = 12;
const HEADER_TEXT_GAP = 10;
const CONTENT_TOP_GAP = 12;

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

function parseImageDimensions(buffer: Buffer) {
  if (buffer.length >= 24) {
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;

    if (isPng && buffer.toString('ascii', 12, 16) === 'IHDR') {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    const sofMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);

    while (offset + 3 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }

      if (offset + 4 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) break;

      if (sofMarkers.has(marker)) {
        if (offset + 9 >= buffer.length) break;
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) return { width, height };
        break;
      }

      offset += 2 + segmentLength;
    }
  }

  return null;
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

    const leftMargin = doc.page.margins.left;
    const rightMargin = doc.page.margins.right;
    const contentWidth = doc.page.width - leftMargin - rightMargin;
    const logoX = leftMargin;
    const logoY = HEADER_TOP_Y + HEADER_TOP_PADDING;
    let logoDrawH = 0;

    if (input.logoDataUrl) {
      const logoBuffer = dataUrlToBuffer(input.logoDataUrl);

      if (logoBuffer) {
        const sig = logoBuffer.subarray(0, 8).toString('hex');
        console.log('[pdf-logo-sig]', sig, 'bytes', logoBuffer.length);
        try {
          const parsed = parseImageDimensions(logoBuffer);
          if (parsed) {
            const scale = Math.min(LOGO_MAX_W / parsed.width, LOGO_MAX_H / parsed.height, 1);
            logoDrawH = Math.max(1, Math.round(parsed.height * scale));
          } else {
            logoDrawH = LOGO_MAX_H;
          }
          doc.image(logoBuffer, logoX, logoY, {
            fit: [LOGO_MAX_W, LOGO_MAX_H],
          });
        } catch (err) {
          console.error('[pdf-logo-error]', err);
        }
      }
    }

    const headerHeight = Math.max(
      HEADER_MIN_H,
      logoDrawH + HEADER_TOP_PADDING + HEADER_BOTTOM_PADDING,
    );
    const headerTextX = leftMargin + LOGO_MAX_W + HEADER_TEXT_GAP;
    const headerTextWidth = Math.max(120, contentWidth - LOGO_MAX_W - HEADER_TEXT_GAP);
    const headerTextY = HEADER_TOP_Y + HEADER_TOP_PADDING;
    const contentStartY = HEADER_TOP_Y + headerHeight + CONTENT_TOP_GAP;

    doc
      .fontSize(24)
      .text(input.companyName || 'Sample Company', headerTextX, headerTextY, {
        width: headerTextWidth,
        lineBreak: false,
      });
    doc
      .fontSize(14)
      .text('Sample Invoice', headerTextX, headerTextY + 30, {
        width: headerTextWidth,
        lineBreak: false,
      });

    doc.y = contentStartY;

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
