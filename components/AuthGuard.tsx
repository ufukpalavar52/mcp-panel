"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CSpinner } from "@coreui/react";
import { useSession, useSessionResolved } from "@/lib/auth/session-store";

/**
 * Keeps the panel behind a session.
 *
 * The redirect waits for the store to have consulted localStorage: on the very first
 * render no session is known yet, and acting on that would bounce a signed in user back
 * to the login page on every refresh.
 *
 * This is a convenience, not a security boundary. The gateway rejects every unauthorised
 * request on its own; hiding the shell only avoids showing a frame that cannot load data.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const resolved = useSessionResolved();
  const router = useRouter();

  useEffect(() => {
    if (resolved && !session) {
      router.replace("/login");
    }
  }, [resolved, session, router]);

  if (!resolved || !session) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <CSpinner color="primary" />
      </div>
    );
  }

  return <>{children}</>;
}
