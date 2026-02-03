type SendInvoiceReminderEmailInput = {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export async function sendInvoiceReminderEmail(
  payload: SendInvoiceReminderEmailInput,
) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // TODO: Replace with your email provider integration.
    console.log('[reminder email stub]', payload.subject, payload.to);
    return;
  }

  const from = process.env.REMINDER_FROM_EMAIL ?? 'Invoicify <noreply@invoicify.dev>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.bodyHtml,
      text: payload.bodyText,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend failed: ${detail}`);
  }
}

export async function sendEmailVerification(options: {
  to: string;
  verifyUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('[verification email stub]', options.to);
    return;
  }

  const from = process.env.REMINDER_FROM_EMAIL ?? 'Invoicify <noreply@invoicify.dev>';
  const subject = 'Verify your email for Lateless';
  const bodyHtml = `
    <p>Hi, please verify your email for Lateless.</p>
    <p><a href="${options.verifyUrl}">Verify email</a></p>
  `;
  const bodyText = `Hi, please verify your email for Lateless.\n\nVerify email: ${options.verifyUrl}`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject,
      html: bodyHtml,
      text: bodyText,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend failed: ${detail}`);
  }
}
