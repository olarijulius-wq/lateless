import { sendEmailVerification } from '@/app/lib/email';
import { issueTokenAndSendLifecycleEmail } from '@/app/lib/lifecycle-email';

export const __testHooks: {
  sendEmailVerificationOverride: null | typeof sendEmailVerification;
} = {
  sendEmailVerificationOverride: null,
};

export async function issueAndSendVerificationEmail(input: {
  userId: string;
  email: string;
}) {
  const sendEmail =
    __testHooks.sendEmailVerificationOverride ?? sendEmailVerification;

  return issueTokenAndSendLifecycleEmail({
    userId: input.userId,
    email: input.email,
    emailType: 'verification',
    tokenColumn: 'verification_token',
    sentAtColumn: 'verification_sent_at',
    pathPrefix: '/verify/',
    send: ({ to, url }) => sendEmail({ to, verifyUrl: url }),
    failureMessage: 'Unknown verification email failure',
  });
}
