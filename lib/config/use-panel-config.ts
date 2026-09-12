"use client";

import { useEffect, useState } from "react";
import { panelConfig, type PanelRuntimeConfig } from "@/lib/api/client";

/**
 * This panel's configuration, once it has arrived.
 *
 * `null` until then rather than a placeholder value: the two things that read it — an
 * environment badge and a warning about the fallback — are both worse when wrong than
 * when late.
 */
export function usePanelConfig(): PanelRuntimeConfig | null {
  const [config, setConfig] = useState<PanelRuntimeConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    panelConfig().then((value) => {
      if (!cancelled) setConfig(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
