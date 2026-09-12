"use client";

import { useState } from "react";
import CIcon from "@coreui/icons-react";
import { cilInfo, cilLockLocked, cilSave } from "@coreui/icons";
import {
  CAlert,
  CAvatar,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CFormText,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CListGroup,
  CListGroupItem,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CTabContent,
  CTabPane,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import {
  localeNames,
  locales,
  setLocale,
  useLocale,
  useT,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

const tabs: { key: string; labelKey: MessageKey }[] = [
  { key: "profile", labelKey: "settings.tab.profile" },
  { key: "security", labelKey: "settings.tab.security" },
  { key: "notifications", labelKey: "settings.tab.notifications" },
];

export default function SettingsView() {
  const [active, setActive] = useState("profile");
  const t = useT();
  const locale = useLocale();

  return (
    <>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
        actions={
          <CButton color="primary" disabled title={t("common.notWired")}>
            <CIcon icon={cilSave} className="me-2" />
            {t("common.saveChanges")}
          </CButton>
        }
      />

      {/* Said once, at the top, rather than as a tooltip on each of four buttons. Somebody
          filling in a form should learn it before they type, not after they press save. */}
      <CAlert color="info" className="d-flex align-items-start gap-2">
        <CIcon icon={cilInfo} className="mt-1 flex-shrink-0" />
        <div className="small">{t("settings.notWired")}</div>
      </CAlert>

      <CCard>
        <CCardHeader className="bg-transparent pb-0">
          <CNav variant="underline-border">
            {tabs.map((tab) => (
              <CNavItem key={tab.key}>
                <CNavLink
                  href="#"
                  active={active === tab.key}
                  onClick={(event) => {
                    event.preventDefault();
                    setActive(tab.key);
                  }}
                >
                  {t(tab.labelKey)}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>
        </CCardHeader>

        <CCardBody>
          <CTabContent>
            <CTabPane visible={active === "profile"}>
              <CRow className="g-4">
                <CCol md={4}>
                  <div className="d-flex align-items-center gap-3">
                    <CAvatar
                      color="primary"
                      textColor="white"
                      size="xl"
                      className="fs-4"
                    >
                      UP
                    </CAvatar>
                    <div>
                      <CButton
                        color="secondary"
                        variant="outline"
                        size="sm"
                        disabled
                        title={t("common.notWired")}
                      >
                        {t("settings.uploadAvatar")}
                      </CButton>
                      <div className="small text-body-secondary mt-1">
                        {t("settings.avatarHint")}
                      </div>
                    </div>
                  </div>
                </CCol>
                <CCol md={8}>
                  <CForm className="row g-3">
                    <div className="col-md-6">
                      <CFormLabel htmlFor="set-name">{t("register.fullName")}</CFormLabel>
                      <CFormInput id="set-name" defaultValue="Ufuk Palavar" />
                    </div>
                    <div className="col-md-6">
                      <CFormLabel htmlFor="set-email">{t("login.email")}</CFormLabel>
                      <CFormInput
                        id="set-email"
                        type="email"
                        defaultValue="ufuk@acme.dev"
                      />
                    </div>
                    <div className="col-md-6">
                      <CFormLabel htmlFor="set-team">{t("users.column.team")}</CFormLabel>
                      <CFormSelect id="set-team" defaultValue="Platform">
                        <option>Platform</option>
                        <option>{t("team.data")}</option>
                        <option>{t("team.product")}</option>
                      </CFormSelect>
                    </div>
                    <div className="col-md-6">
                      <CFormLabel htmlFor="set-locale">{t("settings.language")}</CFormLabel>
                      <CFormSelect
                        id="set-locale"
                        value={locale}
                        onChange={(event) =>
                          setLocale(event.target.value as Locale)
                        }
                      >
                        {locales.map((item) => (
                          <option key={item} value={item}>
                            {localeNames[item]}
                          </option>
                        ))}
                      </CFormSelect>
                    </div>
                    <div className="col-12">
                      <CFormLabel htmlFor="set-bio">{t("settings.about")}</CFormLabel>
                      <CFormTextarea
                        id="set-bio"
                        rows={3}
                        defaultValue={t("settings.bioPlaceholder")}
                      />
                    </div>
                  </CForm>
                </CCol>
              </CRow>
            </CTabPane>

            <CTabPane visible={active === "security"}>
              <CRow className="g-4">
                <CCol lg={6}>
                  <h2 className="h6 fw-semibold mb-3">{t("settings.changePassword")}</h2>
                  <CForm className="d-flex flex-column gap-3">
                    <div>
                      <CFormLabel htmlFor="pw-current">
                        {t("settings.currentPassword")}
                      </CFormLabel>
                      <CInputGroup>
                        <CInputGroupText>
                          <CIcon icon={cilLockLocked} />
                        </CInputGroupText>
                        <CFormInput id="pw-current" type="password" />
                      </CInputGroup>
                    </div>
                    <div>
                      <CFormLabel htmlFor="pw-new">{t("settings.newPassword")}</CFormLabel>
                      <CInputGroup>
                        <CInputGroupText>
                          <CIcon icon={cilLockLocked} />
                        </CInputGroupText>
                        <CFormInput id="pw-new" type="password" />
                      </CInputGroup>
                      <CFormText>
                        {t("settings.passwordRule")}
                      </CFormText>
                    </div>
                    <div>
                      <CButton color="primary" disabled title={t("common.notWired")}>
                        {t("settings.updatePassword")}
                      </CButton>
                    </div>
                  </CForm>
                </CCol>
                <CCol lg={6}>
                  <h2 className="h6 fw-semibold mb-3">{t("settings.sessions")}</h2>
                  <CListGroup>
                    <CListGroupItem className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold small">
                          macOS · Chrome 141
                        </div>
                        <div className="small text-body-secondary">
                          {t("settings.sessionLocation")} · {t("settings.currentSession")}
                        </div>
                      </div>
                      <span className="badge text-bg-success">{t("users.status.active")}</span>
                    </CListGroupItem>
                    <CListGroupItem className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold small">iOS · Safari</div>
                        <div className="small text-body-secondary">
                          Ankara · 2026-08-18
                        </div>
                      </div>
                      <CButton
                        color="danger"
                        variant="ghost"
                        size="sm"
                        disabled
                        title={t("common.notWired")}
                      >
                        {t("settings.closeSession")}
                      </CButton>
                    </CListGroupItem>
                  </CListGroup>
                  <CFormSwitch
                    className="mt-3"
                    id="mfa"
                    label={t("settings.mfa")}
                    defaultChecked
                  />
                </CCol>
              </CRow>
            </CTabPane>

            <CTabPane visible={active === "notifications"}>
              <div className="d-flex flex-column gap-3" style={{ maxWidth: 560 }}>
                <CFormSwitch
                  id="n-down"
                  label={t("settings.notify.modelDown")}
                  defaultChecked
                />
                <CFormSwitch
                  id="n-latency"
                  label={t("settings.notify.latency")}
                  defaultChecked
                />
                <CFormSwitch id="n-weekly" label={t("settings.notify.weekly")} />
                <CFormSwitch
                  id="n-invite"
                  label={t("settings.notify.invite")}
                  defaultChecked
                />
                <div>
                  <CFormLabel htmlFor="n-webhook">{t("settings.notify.webhook")}</CFormLabel>
                  <CFormInput
                    id="n-webhook"
                    placeholder="https://hooks.slack.com/services/…"
                  />
                </div>
              </div>
            </CTabPane>

          </CTabContent>
        </CCardBody>
      </CCard>
    </>
  );
}
