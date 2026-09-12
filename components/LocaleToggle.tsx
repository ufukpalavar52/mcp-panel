"use client";

import CIcon from "@coreui/icons-react";
import { cilLanguage } from "@coreui/icons";
import {
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from "@coreui/react";
import {
  localeNames,
  locales,
  setLocale,
  useLocale,
  useT,
} from "@/lib/i18n";

export default function LocaleToggle() {
  const locale = useLocale();
  const t = useT();

  return (
    <CDropdown variant="nav-item" placement="bottom-end">
      <CDropdownToggle caret={false} aria-label={t("header.language")}>
        <span className="d-flex align-items-center gap-1">
          <CIcon icon={cilLanguage} size="lg" />
          <span className="small fw-semibold text-uppercase">{locale}</span>
        </span>
      </CDropdownToggle>
      <CDropdownMenu>
        {locales.map((item) => (
          <CDropdownItem
            key={item}
            active={locale === item}
            role="button"
            onClick={() => setLocale(item)}
          >
            {localeNames[item]}
          </CDropdownItem>
        ))}
      </CDropdownMenu>
    </CDropdown>
  );
}
