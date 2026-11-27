import { isErrorCode, type ErrorCode } from "@briefklar/shared";
import { ApiError } from "../api/client";
import { useI18n } from "./I18nProvider";

/** Text for an error in the reader's language; the API's English message is the last fallback */
export function useErrorText(): (err: unknown, code?: ErrorCode | null) => string {
  const { t } = useI18n();
  return (err, code) => {
    const errorCode = code ?? (err instanceof ApiError ? err.code : undefined);
    if (isErrorCode(errorCode)) return t.errors[errorCode];
    if (err instanceof ApiError) return t.errors.requestFailed;
    if (err instanceof Error && err.message) return err.message;
    return t.errors.requestFailed;
  };
}
