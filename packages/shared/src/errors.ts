/** Error code matching — keep in sync with apps/api/src/ai_todo_api/errors.py. */

export const AuthErrorCode = {
  invalidToken: "AUTH_INVALID_TOKEN",
  forbidden: "AUTH_FORBIDDEN",
  scopeDenied: "AUTH_SCOPE_DENIED",
  rateLimited: "AUTH_RATE_LIMITED",
} as const;

export type AuthErrorCodeValue =
  (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

const AUTH_LEGACY_ALIASES: Record<string, AuthErrorCodeValue> = {
  UNAUTHORIZED: AuthErrorCode.invalidToken,
  FORBIDDEN: AuthErrorCode.forbidden,
  SESSION_TOKEN_NOT_ALLOWED: AuthErrorCode.scopeDenied,
  RATE_LIMITED: AuthErrorCode.rateLimited,
};

export function matchesAuthErrorCode(
  wire: string | undefined,
  canonical: AuthErrorCodeValue,
): boolean {
  if (!wire) {
    return false;
  }
  if (wire === canonical) {
    return true;
  }
  return AUTH_LEGACY_ALIASES[wire] === canonical;
}

export function isUnauthorizedError(wire: string | undefined): boolean {
  return matchesAuthErrorCode(wire, AuthErrorCode.invalidToken);
}

export function isAuthFailureCode(wire: string | undefined): boolean {
  if (!wire) {
    return false;
  }
  if ((Object.values(AuthErrorCode) as string[]).includes(wire)) {
    return true;
  }
  return wire in AUTH_LEGACY_ALIASES;
}

export const ValErrorCode = {
  invalidInput: "VAL_INVALID_INPUT",
  invalidCursor: "VAL_INVALID_CURSOR",
  contactMethodRequired: "VAL_CONTACT_METHOD_REQUIRED",
} as const;

export type ValErrorCodeValue =
  (typeof ValErrorCode)[keyof typeof ValErrorCode];

const VAL_LEGACY_ALIASES: Record<string, ValErrorCodeValue> = {
  VALIDATION_ERROR: ValErrorCode.invalidInput,
  INVALID_CURSOR: ValErrorCode.invalidCursor,
};

export function matchesValErrorCode(
  wire: string | undefined,
  canonical: ValErrorCodeValue,
): boolean {
  if (!wire) {
    return false;
  }
  if (wire === canonical) {
    return true;
  }
  return VAL_LEGACY_ALIASES[wire] === canonical;
}

export function isValidationError(wire: string | undefined): boolean {
  return matchesValErrorCode(wire, ValErrorCode.invalidInput);
}

export function isInvalidCursorError(wire: string | undefined): boolean {
  return matchesValErrorCode(wire, ValErrorCode.invalidCursor);
}
