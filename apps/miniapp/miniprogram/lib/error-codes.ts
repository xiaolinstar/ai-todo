/** Error code matching — mirror of packages/shared/src/errors.ts (miniapp bundle isolation). */

export const AuthErrorCode = {
  invalidToken: 'AUTH_INVALID_TOKEN',
  forbidden: 'AUTH_FORBIDDEN',
  scopeDenied: 'AUTH_SCOPE_DENIED',
  rateLimited: 'AUTH_RATE_LIMITED',
} as const;

type AuthErrorCodeValue = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

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
  invalidInput: 'VAL_INVALID_INPUT',
  invalidCursor: 'VAL_INVALID_CURSOR',
  contactMethodRequired: 'VAL_CONTACT_METHOD_REQUIRED',
} as const;

type ValErrorCodeValue = (typeof ValErrorCode)[keyof typeof ValErrorCode];

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

export const BizErrorCode = {
  notFound: 'BIZ_NOT_FOUND',
  contactNotFound: 'BIZ_CONTACT_NOT_FOUND',
  idempotencyConflict: 'BIZ_IDEMPOTENCY_CONFLICT',
  reminderInactive: 'BIZ_REMINDER_INACTIVE',
  reminderNoSchedule: 'BIZ_REMINDER_NO_SCHEDULE',
  calendarEventInactive: 'BIZ_CALENDAR_EVENT_INACTIVE',
  calendarEventNoSchedule: 'BIZ_CALENDAR_EVENT_NO_SCHEDULE',
  wechatOpenidMissing: 'BIZ_WECHAT_OPENID_MISSING',
  invalidTarget: 'BIZ_INVALID_TARGET',
} as const;

type BizErrorCodeValue = (typeof BizErrorCode)[keyof typeof BizErrorCode];

const BIZ_LEGACY_ALIASES: Record<string, BizErrorCodeValue> = {
  NOT_FOUND: BizErrorCode.notFound,
  CONTACT_NOT_FOUND: BizErrorCode.contactNotFound,
  IDEMPOTENCY_CONFLICT: BizErrorCode.idempotencyConflict,
  REMINDER_INACTIVE: BizErrorCode.reminderInactive,
  REMINDER_NO_SCHEDULE: BizErrorCode.reminderNoSchedule,
  CALENDAR_EVENT_INACTIVE: BizErrorCode.calendarEventInactive,
  CALENDAR_EVENT_NO_SCHEDULE: BizErrorCode.calendarEventNoSchedule,
  WECHAT_OPENID_MISSING: BizErrorCode.wechatOpenidMissing,
  INVALID_TARGET: BizErrorCode.invalidTarget,
};

export function matchesBizErrorCode(
  wire: string | undefined,
  canonical: BizErrorCodeValue,
): boolean {
  if (!wire) {
    return false;
  }
  if (wire === canonical) {
    return true;
  }
  return BIZ_LEGACY_ALIASES[wire] === canonical;
}

export function isNotFoundError(wire: string | undefined): boolean {
  return matchesBizErrorCode(wire, BizErrorCode.notFound);
}

export const SysErrorCode = {
  dbUnavailable: 'SYS_DB_UNAVAILABLE',
  internalError: 'SYS_INTERNAL_ERROR',
  wechatNotConfigured: 'SYS_WECHAT_NOT_CONFIGURED',
  httpError: 'SYS_HTTP_ERROR',
} as const;

type SysErrorCodeValue = (typeof SysErrorCode)[keyof typeof SysErrorCode];

const SYS_LEGACY_ALIASES: Record<string, SysErrorCodeValue> = {
  DATABASE_ERROR: SysErrorCode.dbUnavailable,
  INTERNAL_ERROR: SysErrorCode.internalError,
  WECHAT_NOT_CONFIGURED: SysErrorCode.wechatNotConfigured,
  HTTP_ERROR: SysErrorCode.httpError,
};

export function matchesSysErrorCode(
  wire: string | undefined,
  canonical: SysErrorCodeValue,
): boolean {
  if (!wire) {
    return false;
  }
  if (wire === canonical) {
    return true;
  }
  return SYS_LEGACY_ALIASES[wire] === canonical;
}

export function isDatabaseUnavailableError(wire: string | undefined): boolean {
  return matchesSysErrorCode(wire, SysErrorCode.dbUnavailable);
}
