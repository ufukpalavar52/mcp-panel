"use client";

import { useEffect, useState } from "react";
import CIcon from "@coreui/icons-react";
import { cilMoon, cilSun } from "@coreui/icons";
import {
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from "@coreui/react";
import { useT, type MessageKey } from "@/lib/i18n";

type Theme = "light" | "dark";

const STORAGE_KEY = "mcp-theme";

const options: { value: Theme; labelKey: MessageKey; icon: string[] }[] = [
  { value: "light", labelKey: "header.theme.light", icon: cilSun },
  { value: "dark", labelKey: "header.theme.dark", icon: cilMoon },
];

/**
 * The starting value is read from the data-coreui-theme the layout's inline script wrote
 * onto <html>, so the theme does not jump during hydration.
 */
function initialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.coreuiTheme === "dark"
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const t = useT();

  useEffect(() => {
    document.documentElement.dataset.coreuiTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const active = options.find((option) => option.value === theme) ?? options[0];

  return (
    <CDropdown variant="nav-item" placement="bottom-end">
      <CDropdownToggle caret={false} aria-label={t("header.theme")}>
        <span suppressHydrationWarning>
          <CIcon icon={active.icon} size="lg" />
        </span>
      </CDropdownToggle>
      <CDropdownMenu>
        {options.map((option) => (
          <CDropdownItem
            key={option.value}
            active={theme === option.value}
            className="d-flex align-items-center gap-2"
            role="button"
            onClick={() => setTheme(option.value)}
          >
            <CIcon icon={option.icon} className="me-1" />
            {t(option.labelKey)}
          </CDropdownItem>
        ))}
      </CDropdownMenu>
    </CDropdown>
  );
}
