"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CIcon from "@coreui/icons-react";
import {
  cilAccountLogout,
  cilBell,
  cilMenu,
  cilSearch,
  cilSettings,
  cilUser,
} from "@coreui/icons";
import {
  CAvatar,
  CBadge,
  CBreadcrumb,
  CBreadcrumbItem,
  CContainer,
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormInput,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CInputGroup,
  CInputGroupText,
} from "@coreui/react";
import { resolveBreadcrumb } from "@/lib/nav";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { authApi } from "@/lib/api/endpoints";
import { clearSession, useSession } from "@/lib/auth/session-store";
import EnvironmentBadge from "./EnvironmentBadge";
import LocaleToggle from "./LocaleToggle";
import ThemeToggle from "./ThemeToggle";

type Props = {
  onToggleSidebar: () => void;
};

export default function AppHeader({ onToggleSidebar }: Props) {
  const pathname = usePathname();
  const crumbs = resolveBreadcrumb(pathname);
  const t = useT();
  const session = useSession();
  const router = useRouter();

  /** Revokes the token server side, then drops it locally whatever the answer was. */
  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // An unreachable gateway must not trap the user in a signed in shell.
    }
    clearSession();
    router.replace("/login");
  };

  const initials = (session?.user.fullName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("tr");

  return (
    <CHeader position="sticky" className="app-header mb-4 p-0">
      <CContainer fluid className="px-3 px-lg-4 py-2">
        <CHeaderToggler
          className="d-lg-none me-2"
          onClick={onToggleSidebar}
          aria-label={t("header.openMenu")}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

        <div className="d-none d-md-block">
          <CBreadcrumb className="mb-0">
            <CBreadcrumbItem>
              <Link href="/dashboard">{t("header.home")}</Link>
            </CBreadcrumbItem>
            {crumbs.map((crumb) => (
              <CBreadcrumbItem key={crumb.labelKey} active={!crumb.href}>
                {crumb.href ? (
                  <Link href={crumb.href}>{t(crumb.labelKey)}</Link>
                ) : (
                  t(crumb.labelKey)
                )}
              </CBreadcrumbItem>
            ))}
          </CBreadcrumb>
        </div>

        <CHeaderNav className="ms-auto align-items-center gap-1">
          <EnvironmentBadge />
          <div className="d-none d-lg-block me-2" style={{ width: 260 }}>
            <CInputGroup size="sm">
              <CInputGroupText className="bg-body-tertiary border-end-0">
                <CIcon icon={cilSearch} />
              </CInputGroupText>
              <CFormInput
                className="border-start-0"
                placeholder={t("header.searchPlaceholder")}
                aria-label={t("common.search")}
              />
            </CInputGroup>
          </div>

          <CDropdown variant="nav-item" placement="bottom-end">
            <CDropdownToggle caret={false} aria-label={t("header.notifications")}>
              <span className="position-relative">
                <CIcon icon={cilBell} size="lg" />
                <CBadge
                  color="danger"
                  position="top-end"
                  shape="rounded-pill"
                  className="p-1"
                >
                  <span className="visually-hidden">{t("header.unread")}</span>
                </CBadge>
              </span>
            </CDropdownToggle>
            <CDropdownMenu className="pt-0" style={{ minWidth: 300 }}>
              <CDropdownHeader className="bg-body-secondary fw-semibold py-2">
                {t("header.notifications")}
              </CDropdownHeader>
              <CDropdownItem className="text-wrap">
                <div className="fw-semibold">
                  {t("header.notification.fleetHalted")}
                </div>
                <div className="small text-body-secondary">
                  {t("header.time.hoursAgo", { count: 3 })}
                </div>
              </CDropdownItem>
              <CDropdownItem className="text-wrap">
                <div className="fw-semibold">
                  {t("header.notification.modelSlow")}
                </div>
                <div className="small text-body-secondary">
                  {t("header.time.hoursAgo", { count: 1 })}
                </div>
              </CDropdownItem>
              <CDropdownItem className="text-wrap">
                <div className="fw-semibold">
                  {t("header.notification.inviteAccepted")}
                </div>
                <div className="small text-body-secondary">
                  {t("header.time.yesterday")}
                </div>
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>

          <LocaleToggle />

          <ThemeToggle />

          <CDropdown variant="nav-item" placement="bottom-end">
            <CDropdownToggle caret={false} className="py-0 pe-0">
              <CAvatar color="primary" textColor="white" size="md">
                {initials}
              </CAvatar>
            </CDropdownToggle>
            <CDropdownMenu className="pt-0" style={{ minWidth: 220 }}>
              <CDropdownHeader className="bg-body-secondary py-2">
                <div className="fw-semibold">{session?.user.fullName}</div>
                <div className="small text-body-secondary">{session?.user.email}</div>
              </CDropdownHeader>
              <CDropdownItem as={Link} href="/settings">
                <CIcon icon={cilUser} className="me-2" />
                {t("header.profile")}
              </CDropdownItem>
              <CDropdownItem as={Link} href="/settings">
                <CIcon icon={cilSettings} className="me-2" />
                {t("header.settings")}
              </CDropdownItem>
              <CDropdownDivider />
              <CDropdownItem
                role="button"
                className="text-danger"
                onClick={handleLogout}
              >
                <CIcon icon={cilAccountLogout} className="me-2" />
                {t("header.logout")}
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>
        </CHeaderNav>
      </CContainer>
    </CHeader>
  );
}
