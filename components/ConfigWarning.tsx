"use client";

import CIcon from "@coreui/icons-react";
import { cilWarning } from "@coreui/icons";
import { CAlert } from "@coreui/react";
import { useT } from "@/lib/i18n";
import { usePanelConfig } from "@/lib/config/use-panel-config";

/**
 * Says so when the panel is running on built-in defaults.
 *
 * The fallback is the right behaviour — if mcp-config is down then so is the gateway, and
 * loading the panel to report an unreachable API tells an operator more than a blank page
 * would. But a fallback nobody is told about is indistinguishable from a working setup,
 * which is precisely the moment it matters.
 */
export default function ConfigWarning() {
  const config = usePanelConfig();

  if (!config || config.source !== "fallback") return null;

  return <Warning api={config.apiUrl} reason={config.reason} />;
}

function Warning({ api, reason }: { api: string; reason?: string }) {
  const t = useT();

  return (
    <CAlert
      color="warning"
      className="d-flex align-items-start gap-2 small mb-0 rounded-0 border-0 border-bottom"
    >
      <CIcon icon={cilWarning} className="mt-1 flex-shrink-0" />
      <div>
        <div>{t("config.fallback", { api })}</div>
        {reason && <div className="text-body-secondary mono mt-1">{reason}</div>}
      </div>
    </CAlert>
  );
}
