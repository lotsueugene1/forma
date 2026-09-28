const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const DEFAULT_MIN_SCORE = 0.5;
const MAX_TOKEN_LENGTH = 4096;

type RecaptchaFailureReason =
  | 'missing_token'
  | 'invalid_token'
  | 'low_score'
  | 'action_mismatch'
  | 'service_unavailable';

export type RecaptchaVerificationResult =
  | {
      success: true;
      skipped: boolean;
      score?: number;
    }
  | {
      success: false;
      reason: RecaptchaFailureReason;
      score?: number;
      errorCodes?: string[];
    };

interface VerifyRecaptchaV3Options {
  token: unknown;
  remoteIp?: string | null;
  expectedAction: string;
  minScore?: number;
  secretKey?: string;
  fetchImpl?: typeof fetch;
}

type VerifyRecaptchaV2Options = Omit<VerifyRecaptchaV3Options, 'expectedAction' | 'minScore'>;

interface RecaptchaApiResponse {
  success?: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * Verify a visible reCAPTCHA v2 checkbox response. Google performs the
 * challenge and domain checks; the server only accepts a successful token.
 */
export async function verifyRecaptchaV2({
  token,
  remoteIp,
  secretKey = process.env.SIGNUP_RECAPTCHA_SECRET_KEY,
  fetchImpl = fetch,
}: VerifyRecaptchaV2Options): Promise<RecaptchaVerificationResult> {
  const normalizedSecret = secretKey?.trim();

  if (!normalizedSecret) {
    return { success: true, skipped: true };
  }

  if (typeof token !== 'string' || !token.trim()) {
    return { success: false, reason: 'missing_token' };
  }

  if (token.length > MAX_TOKEN_LENGTH) {
    return { success: false, reason: 'invalid_token' };
  }

  let response: Response;
  try {
    response = await fetchImpl(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: normalizedSecret,
        response: token,
        ...(remoteIp && { remoteip: remoteIp }),
      }),
      cache: 'no-store',
    });
  } catch {
    return { success: false, reason: 'service_unavailable' };
  }

  if (!response.ok) {
    return { success: false, reason: 'service_unavailable' };
  }

  let data: RecaptchaApiResponse;
  try {
    data = await response.json() as RecaptchaApiResponse;
  } catch {
    return { success: false, reason: 'service_unavailable' };
  }

  if (data.success !== true) {
    const configurationError = data['error-codes']?.some((code) =>
      code === 'missing-input-secret' || code === 'invalid-input-secret'
    );

    return {
      success: false,
      reason: configurationError ? 'service_unavailable' : 'invalid_token',
      errorCodes: data['error-codes'],
    };
  }

  return { success: true, skipped: false };
}

/**
 * Verify a reCAPTCHA v3 token. Verification is optional until a secret key is
 * configured, then fails closed so an outage or malformed token cannot create
 * an unprotected account.
 */
export async function verifyRecaptchaV3({
  token,
  remoteIp,
  expectedAction,
  minScore = DEFAULT_MIN_SCORE,
  secretKey = process.env.RECAPTCHA_SECRET_KEY,
  fetchImpl = fetch,
}: VerifyRecaptchaV3Options): Promise<RecaptchaVerificationResult> {
  const normalizedSecret = secretKey?.trim();

  if (!normalizedSecret) {
    return { success: true, skipped: true };
  }

  if (typeof token !== 'string' || !token.trim()) {
    return { success: false, reason: 'missing_token' };
  }

  if (token.length > MAX_TOKEN_LENGTH) {
    return { success: false, reason: 'invalid_token' };
  }

  let response: Response;
  try {
    response = await fetchImpl(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: normalizedSecret,
        response: token,
        ...(remoteIp && { remoteip: remoteIp }),
      }),
      cache: 'no-store',
    });
  } catch {
    return { success: false, reason: 'service_unavailable' };
  }

  if (!response.ok) {
    return { success: false, reason: 'service_unavailable' };
  }

  let data: RecaptchaApiResponse;
  try {
    data = await response.json() as RecaptchaApiResponse;
  } catch {
    return { success: false, reason: 'service_unavailable' };
  }

  if (data.success !== true) {
    const configurationError = data['error-codes']?.some((code) =>
      code === 'missing-input-secret' || code === 'invalid-input-secret'
    );

    return {
      success: false,
      reason: configurationError ? 'service_unavailable' : 'invalid_token',
      errorCodes: data['error-codes'],
    };
  }

  if (data.action !== expectedAction) {
    return { success: false, reason: 'action_mismatch', score: data.score };
  }

  if (typeof data.score !== 'number' || data.score < minScore) {
    return { success: false, reason: 'low_score', score: data.score };
  }

  return { success: true, skipped: false, score: data.score };
}
