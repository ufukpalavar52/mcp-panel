import { beforeEach, describe, expect, it } from "vitest";

import { clearSession, setSession } from "@/lib/auth/session-store";
import { notify, useToasts } from "@/lib/ui/toast-store";
import { renderHook } from "@testing-library/react";

beforeEach(() => {
  window.localStorage.clear();
  clearSession();
});

/**
 * A toast belongs to the session that raised it.
 *
 * The queue is module state and the login screen draws no toaster, so a message raised
 * before signing out waited there, invisible, and turned up after the next sign-in —
 * describing something that had happened to a session that no longer existed.
 *
 * Where the message was about whether an action succeeded, that was not merely confusing:
 * somebody was told their password had been changed on the screen they reached after
 * being signed out for failing to change it.
 */
describe("toasts and the session", () => {
  it("throws away anything still queued when the session ends", () => {
    setSession({
      accessToken: "a",
      refreshToken: "r",
      user: {
        id: 1,
        email: "me@example.com",
        fullName: "Me",
        role: "admin",
        status: "active",
        team: null,
        avatarUrl: null,
      },
    });

    notify.success("toast.saved");
    expect(renderHook(() => useToasts()).result.current).toHaveLength(1);

    clearSession();

    expect(renderHook(() => useToasts()).result.current).toHaveLength(0);
  });
});
