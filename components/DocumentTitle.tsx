"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { resolveBreadcrumb } from "@/lib/nav";

/**
 * Keeps the browser tab's title in the interface language.
 *
 * Each route exports a static `metadata.title`, which is rendered on the server — where the
 * chosen language is not known, because it lives in the browser. So an English panel drew
 * an English page under a Turkish tab.
 *
 * The same arrangement the language itself uses: the server renders the default, and the
 * stored choice takes over once there is a browser to ask. The static export stays as the
 * value that is correct before hydration and for anything reading the page without running
 * it.
 *
 * The title comes from the breadcrumb rather than a second table of its own — one route,
 * one name, and no chance of the tab and the heading disagreeing.
 */
export default function DocumentTitle() {
  const pathname = usePathname();
  const t = useT();

  useEffect(() => {
    const crumbs = resolveBreadcrumb(pathname);
    const page = crumbs.at(-1);

    document.title = page
      ? `${t(page.labelKey)} · ${t("app.name")}`
      : t("app.name");
  }, [pathname, t]);

  return null;
}
