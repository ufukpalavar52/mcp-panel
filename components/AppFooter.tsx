"use client";

import { CFooter } from "@coreui/react";
import { useT } from "@/lib/i18n";

export default function AppFooter() {
  const t = useT();

  return (
    <CFooter className="px-3 px-lg-4 mt-4 bg-transparent border-0 small text-body-secondary">
      <div>
        <span className="fw-semibold">{t("app.name")}</span> © 2026 Acme
      </div>
      <div className="ms-auto">{t("footer.builtWith")}</div>
    </CFooter>
  );
}
