export type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'OAUTH_ONLY_ACCOUNT'
  | 'EMAIL_NOT_VERIFIED'
  | 'DATABASE_UNAVAILABLE'
  | 'AUTHENTICATION_FAILED';

export type LoginState = {
  success: boolean;
  message: string | null;
  code: LoginErrorCode | null;
  status: number | null;
  needsVerification: boolean;
  emailForVerification: string | null;
  needsTwoFactor: boolean;
  emailForTwoFactor: string | null;
};

export const initialLoginState: LoginState = {
  success: false,
  message: null,
  code: null,
  status: null,
  needsVerification: false,
  emailForVerification: null,
  needsTwoFactor: false,
  emailForTwoFactor: null,
};
