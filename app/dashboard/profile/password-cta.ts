export type PasswordCtaCopy = {
  actionLabel: 'Set password' | 'Change password';
  description: string;
  successMessage: (email: string) => string;
};

export function getPasswordCtaCopy(hasPassword: boolean): PasswordCtaCopy {
  if (hasPassword) {
    return {
      actionLabel: 'Change password',
      description: 'Send a secure link to your email to change your password.',
      successMessage: (email: string) => `Password reset link sent to ${email}.`,
    };
  }

  return {
    actionLabel: 'Set password',
    description:
      'You signed up with Google/GitHub. Set a password to enable email/password sign-in.',
    successMessage: (email: string) => `Password setup link sent to ${email}.`,
  };
}
