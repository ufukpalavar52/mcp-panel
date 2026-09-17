import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthGuard from "@/components/AuthGuard";
import { setSession } from "@/lib/auth/session-store";

vi.mock("@/lib/api/endpoints", () => ({
  authApi: { changePassword: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function signIn(mustChangePassword: boolean) {
  setSession({
    accessToken: "a",
    refreshToken: "r",
    user: {
      id: 1,
      email: "me@example.com",
      fullName: "Me",
      role: "developer",
      status: "active",
      team: null,
      avatarUrl: null,
      mustChangePassword,
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

/**
 * The one lock the panel has.
 *
 * An administrator can create an account with a password they chose. Two people then know
 * it and only one of them owns the account — so nothing else opens until that is no longer
 * true.
 */
describe("a password somebody else chose", () => {
  it("shows the password screen instead of the panel", () => {
    signIn(true);

    render(
      <AuthGuard>
        <div>the panel</div>
      </AuthGuard>,
    );

    expect(screen.queryByText("the panel")).toBeNull();
    expect(
      screen.getByText(/choose your password|şifreni belirle/i),
    ).toBeInTheDocument();
  });

  it("lets the panel through once the flag is clear", () => {
    signIn(false);

    render(
      <AuthGuard>
        <div>the panel</div>
      </AuthGuard>,
    );

    expect(screen.getByText("the panel")).toBeInTheDocument();
  });

  it("is one decision rather than one per page", () => {
    /*
     * The guard wraps every route, so a page added later is covered without anybody
     * remembering to cover it. The page that forgets is the one that matters.
     */
    signIn(true);

    render(
      <AuthGuard>
        <div>runs</div>
        <div>definitions</div>
      </AuthGuard>,
    );

    expect(screen.queryByText("runs")).toBeNull();
    expect(screen.queryByText("definitions")).toBeNull();
  });
});
