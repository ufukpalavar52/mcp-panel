"use client";

import { CBadge } from "@coreui/react";
import { useT } from "@/lib/i18n";
import { usePanelConfig } from "@/lib/config/use-panel-config";

/**
 * Which environment this panel is pointed at, from mcp-config.
 *
 * A production panel and a local one are otherwise identical on screen, and they stay
 * identical right up until someone acts on the wrong one. Anything other than `local` is
 * coloured to be noticed.
 */
export default function EnvironmentBadge() {
  const t = useT();
  const config = usePanelConfig();

  if (!config || config.source === "fallback") return null;

  return (
    <CBadge
      color={config.environment === "local" ? "secondary" : "danger"}
      shape="rounded-pill"
      title={t("config.fromServer", { api: config.apiUrl })}
    >
      {config.environment}
    </CBadge>
  );
}
