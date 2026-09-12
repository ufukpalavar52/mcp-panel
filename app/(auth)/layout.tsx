"use client";

import Link from "next/link";
import CIcon from "@coreui/icons-react";
import { cilCheckCircle } from "@coreui/icons";
import AppLogo from "@/components/AppLogo";
import { useT } from "@/lib/i18n";

const highlightKeys = [
  "auth.highlight.models",
  "auth.highlight.tools",
  "auth.highlight.metrics",
] as const;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useT();

  return (
    <div className="auth-shell">
      <aside className="auth-aside flex-column justify-content-between p-5">
        <Link
          href="/dashboard"
          className="d-inline-flex align-items-center gap-2 text-white text-decoration-none fw-semibold"
        >
          <AppLogo size={34} tone="inverse" />
          {t("app.name")}
        </Link>

        <div style={{ maxWidth: 26 * 16 }}>
          <h2 className="display-6 fw-semibold lh-sm mb-3">
            {t("auth.tagline")}
          </h2>
          <ul className="list-unstyled d-flex flex-column gap-2 mb-0 text-white-50">
            {highlightKeys.map((key) => (
              <li key={key} className="d-flex align-items-start gap-2">
                <CIcon icon={cilCheckCircle} className="mt-1 flex-shrink-0" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="small text-white-50 mb-0">
          {t("auth.footer")}
        </p>
      </aside>

      <main className="d-flex align-items-center justify-content-center p-4 p-sm-5">
        {children}
      </main>
    </div>
  );
}
