"use client";

import type { MessageKey } from "@/lib/i18n/tr";
import { ApiRequestError, ApiUnreachableError } from "@/lib/api/errors";
import { notify } from "./toast-store";

/**
 * Runs an operation and tells the user how it went.
 *
 * Wrapped around the action hooks rather than around each call site. The hooks are where
 * an operation's meaning lives — "saved", "deleted" — and there are far more call sites
 * than hooks, so announcing there would mean every new button remembering to do it.
 *
 * **Failure does not throw.** Most call sites are fire and forget (`toggle(id)` with no
 * `await`), and rethrowing would turn every rejection into an unhandled one — a message in
 * the console for the developer instead of a message on screen for the operator. The
 * return value carries the outcome for the callers that need it: `undefined` means it
 * failed, and a caller about to navigate away should check.
 */
export async function announce<T>(
  operation: () => Promise<T>,
  successKey: MessageKey,
  params?: Record<string, string | number>,
): Promise<T | undefined> {
  try {
    const result = await operation();
    notify.success(successKey, params);
    return result;
  } catch (error) {
    if (error instanceof ApiUnreachableError) {
      notify.failureKey(error.messageKey);
    } else {
      notify.failure(describe(error));
    }
    return undefined;
  }
}

/**
 * The most specific description available.
 *
 * The gateway's message is preferred over anything written here: it names the actual
 * problem, and replacing it with a generic phrase would throw away the only part the
 * operator can act on.
 */
function describe(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
