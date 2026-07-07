import { GraphQLError } from "graphql";
import { t, type TranslationParams } from "../i18n";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "BAD_USER_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_SERVER_ERROR";

/**
 * Application error carrying an i18n message key. The human-readable `message`
 * is resolved against the request-scoped locale at throw time; the key + params
 * are also kept in `extensions` so `formatError` can re-localize if needed.
 */
export class AppError extends GraphQLError {
  constructor(code: ErrorCode, messageKey: string, params?: TranslationParams) {
    super(t(messageKey, params), {
      extensions: { code, messageKey, params },
    });
  }
}

export const errors = {
  unauthenticated: (key = "errors.unauthenticated", p?: TranslationParams) =>
    new AppError("UNAUTHENTICATED", key, p),
  forbidden: (key = "errors.forbidden", p?: TranslationParams) =>
    new AppError("FORBIDDEN", key, p),
  badInput: (key = "errors.validation", p?: TranslationParams) =>
    new AppError("BAD_USER_INPUT", key, p),
  notFound: (key = "errors.notFound", p?: TranslationParams) =>
    new AppError("NOT_FOUND", key, p),
  conflict: (key: string, p?: TranslationParams) => new AppError("CONFLICT", key, p),
  rateLimited: (key = "errors.rateLimited", p?: TranslationParams) =>
    new AppError("RATE_LIMITED", key, p),
  internal: (key = "errors.internal", p?: TranslationParams) =>
    new AppError("INTERNAL_SERVER_ERROR", key, p),
};
