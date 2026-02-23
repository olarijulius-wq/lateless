export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import postgres from 'postgres';
import {
  enforceRateLimit,
  parseRouteParams,
  routeUuidParamsSchema,
} from '@/app/lib/security/api-guard';
import { fetchInvoiceById } from '@/app/lib/data';
import { formatDateToLocal } from '@/app/lib/utils';
import { fetchCompanyProfileForWorkspace } from '@/app/lib/company-profile';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';

import type PDFDocumentType from 'pdfkit';
const PDFDocument = require('pdfkit/js/pdfkit.standalone') as typeof PDFDocumentType;
const LOGO_MAX_W = 160;
const LOGO_MAX_H = 48;
const HEADER_MIN_H = 72;
const HEADER_TOP_Y = 45;
const HEADER_TOP_PADDING = 12;
const HEADER_BOTTOM_PADDING = 12;
const HEADER_TEXT_GAP = 10;
const CONTENT_TOP_GAP = 12;

function formatAmountForPdf(amountCents: number) {
  const value = amountCents / 100;
  return `${value.toFixed(2)} EUR`;
}

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

async function buildInvoicePdf(input: {
  invoice: {
    id: string;
    customer_name: string;
    customer_email: string;
    status: string;
    date: string;
    amount: number;
    invoice_number: string | null;
  };
  company: {
    companyName: string;
    vatOrRegNumber: string;
    address: string;
    companyEmail: string;
    invoiceFooter: string;
    logoDataUrl: string | null;
  };
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

    if (input.company.logoDataUrl) {
      const logoBuffer = dataUrlToBuffer(input.company.logoDataUrl);

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

    const invoiceLabel = input.invoice.invoice_number ?? input.invoice.id.slice(0, 8);
    const headerHeight = Math.max(
      HEADER_MIN_H,
      logoDrawH + HEADER_TOP_PADDING + HEADER_BOTTOM_PADDING,
    );
    const headerTextX = leftMargin + LOGO_MAX_W + HEADER_TEXT_GAP;
    const headerTextWidth = Math.max(120, contentWidth - LOGO_MAX_W - HEADER_TEXT_GAP);
    const headerTextY = HEADER_TOP_Y + HEADER_TOP_PADDING;
    const contentStartY = HEADER_TOP_Y + headerHeight + CONTENT_TOP_GAP;

    doc
      .fontSize(22)
      .text(input.company.companyName || 'Lateless', headerTextX, headerTextY, {
        width: headerTextWidth,
        lineBreak: false,
      });
    doc
      .fontSize(14)
      .text(`Invoice ${invoiceLabel}`, headerTextX, headerTextY + 28, {
        width: headerTextWidth,
        lineBreak: false,
      });

    doc.y = contentStartY;
    doc.moveDown(0.5);
    doc.fontSize(12).text('From');
    if (input.company.address) doc.text(input.company.address);
    if (input.company.vatOrRegNumber) doc.text(`VAT/Reg: ${input.company.vatOrRegNumber}`);
    if (input.company.companyEmail) doc.text(`Email: ${input.company.companyEmail}`);

    doc.moveDown();
    doc.fontSize(12).text('To');
    doc.text(input.invoice.customer_name);
    doc.text(input.invoice.customer_email);

    doc.moveDown();
    doc.fontSize(12).text(`Date: ${formatDateToLocal(input.invoice.date)}`);
    doc.text(`Status: ${input.invoice.status}`);
    doc.text(`Amount: ${formatAmountForPdf(input.invoice.amount)}`);

    const footer = input.company.invoiceFooter || 'Generated by Lateless';
    doc.fontSize(10).fillColor('#444444').text(footer, 50, 760, { width: 500 });

    doc.end();
  });
}

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userEmail = session.user.email.trim().toLowerCase();

  const rl = await enforceRateLimit(req, {
    bucket: 'invoice_pdf',
    windowSec: 60,
    ipLimit: 30,
    userLimit: 20,
  }, { userKey: userEmail });
  if (rl) return rl;

  const rawParams = await props.params;
  const parsedParams = parseRouteParams(routeUuidParamsSchema, rawParams);
  if (!parsedParams.ok) return parsedParams.response;
  const params = parsedParams.data;

  const context = await ensureWorkspaceContextForCurrentUser();

  const [invoice, companyProfile] = await Promise.all([
    fetchInvoiceById(params.id),
    fetchCompanyProfileForWorkspace(context.workspaceId),
  ]);

  if (!invoice) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const pdfBuffer = await buildInvoicePdf({
    invoice,
    company: companyProfile,
  });
  const filenameId = invoice.invoice_number ?? invoice.id;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${filenameId}.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
