"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CIcon from "@coreui/icons-react";
import AppLogo from "@/components/AppLogo";
import {
  CBadge,
  CCloseButton,
  CNavTitle,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarNav,
} from "@coreui/react";
import { navigation } from "@/lib/nav";
import { useT } from "@/lib/i18n";
import { useErrorLogCount } from "@/lib/api/dashboard-store";

type Props = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

export default function AppSidebar({ visible, onVisibleChange }: Props) {
  const pathname = usePathname();
  const t = useT();
  const errorLogCount = useErrorLogCount();

  // The sidebar stays open on a desktop; only on mobile does following a link close it.
  const closeOnMobile = () => {
    if (window.matchMedia("(max-width: 991.98px)").matches) {
      onVisibleChange(false);
    }
  };

  return (
    <CSidebar
      className="app-sidebar border-end"
      colorScheme="dark"
      position="fixed"
      visible={visible}
      onVisibleChange={onVisibleChange}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand
          as={Link}
          href="/dashboard"
          className="d-flex align-items-center gap-2 text-decoration-none"
        >
          <AppLogo size={32} />
          <span className="fw-semibold">{t("app.name")}</span>
        </CSidebarBrand>
        <CCloseButton
          dark
          className="d-lg-none"
          onClick={() => onVisibleChange(false)}
        />
      </CSidebarHeader>

      <CSidebarNav>
        {navigation.map((section) => (
          <Fragment key={section.titleKey}>
            <CNavTitle>{t(section.titleKey)}</CNavTitle>
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <li key={item.href} className="nav-item">
                  <Link
                    href={item.href}
                    className={`nav-link${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={closeOnMobile}
                  >
                    <CIcon icon={item.icon} className="nav-icon" />
                    <span className="flex-grow-1">{t(item.labelKey)}</span>
                    {item.badgeSource === "logErrors" && errorLogCount > 0 && (
                      <CBadge color="danger" className="ms-auto">
                        {errorLogCount}
                      </CBadge>
                    )}
                  </Link>
                </li>
              );
            })}
          </Fragment>
        ))}
      </CSidebarNav>

      <CSidebarFooter className="border-top small">
        <div className="d-flex align-items-center justify-content-between w-100 text-white-50">
          <span>{t("app.version", { version: "0.1.0" })}</span>
          <CBadge color="success" shape="rounded-pill">
            beta
          </CBadge>
        </div>
      </CSidebarFooter>
    </CSidebar>
  );
}
