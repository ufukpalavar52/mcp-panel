"use client";

import { useEffect, useState } from "react";
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
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CFormText,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import { authApi } from "@/lib/api/endpoints";
import { clearSession } from "@/lib/auth/session-store";
import { notify } from "@/lib/ui/toast-store";
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

  // Disabled until now, with a "not wired" tooltip, because there was no endpoint behind
  // it. There is one — the same one the forced change screen uses.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [sessions, setSessions] = useState<number | null>(null);
  const [endingSessions, setEndingSessions] = useState(false);

  useEffect(() => {
    authApi.sessions()
      .then((answer) => setSessions(answer.active))
      // A count nobody can read is not worth an error banner on a settings page.
      .catch(() => setSessions(null));
  }, []);

  async function endEverywhere() {
    setEndingSessions(true);
    try {
      await authApi.logoutEverywhere();
      // This screen included: signing out everywhere that leaves the screen you pressed it
      // on signed in has not done what it says.
      clearSession();
    } catch (error) {
      notify.failure(error instanceof Error ? error.message : t("tools.run.unexpected"));
      setEndingSessions(false);
    }
  }

  async function changePassword() {
    setChanging(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify.success("settings.passwordChanged");
    } catch (error) {
      notify.failure(error instanceof Error ? error.message : t("tools.run.unexpected"));
    } finally {
      setChanging(false);
    }
  }


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
                        <CFormInput
                          id="pw-current"
                          type="password"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                        />
                      </CInputGroup>
                    </div>
                    <div>
                      <CFormLabel htmlFor="pw-new">{t("settings.newPassword")}</CFormLabel>
                      <CInputGroup>
                        <CInputGroupText>
                          <CIcon icon={cilLockLocked} />
                        </CInputGroupText>
                        <CFormInput
                          id="pw-new"
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                        />
                      </CInputGroup>
                      <CFormText>
                        {t("settings.passwordRule")}
                      </CFormText>
                    </div>
                    <div>
                      {/* Asked for because otherwise the form reads as "password, password
                          again" — which is how somebody types their new password into the
                          field that wanted the old one, is refused, and is then told their
                          new password does not work. */}
                      <CFormLabel htmlFor="pw-confirm">
                        {t("settings.confirmPassword")}
                      </CFormLabel>
                      <CInputGroup className="has-validation">
                        <CInputGroupText>
                          <CIcon icon={cilLockLocked} />
                        </CInputGroupText>
                        <CFormInput
                          id="pw-confirm"
                          type="password"
                          value={confirmPassword}
                          invalid={
                            confirmPassword.length > 0 && confirmPassword !== newPassword
                          }
                          onChange={(event) => setConfirmPassword(event.target.value)}
                        />
                        <CFormFeedback invalid>
                          {t("settings.passwordMismatch")}
                        </CFormFeedback>
                      </CInputGroup>
                    </div>
                    <div>
                      <CButton
                        color="primary"
                        disabled={
                          changing
                          || !currentPassword
                          || newPassword.length < 12
                          || newPassword !== confirmPassword
                        }
                        onClick={changePassword}
                      >
                        {changing && <CSpinner size="sm" className="me-2" />}
                        {t("settings.updatePassword")}
                      </CButton>
                    </div>
                  </CForm>
                </CCol>
                <CCol lg={6}>
                  <h2 className="h6 fw-semibold mb-3">{t("settings.sessions")}</h2>
                  {/* A count, and nothing else. What stood here was a device, a city
                      and a date, all of them invented — the city was a translation string.
                      None of it is recorded anywhere, so none of it is shown: a number
                      that is true is worth more than a list that is not.

                      It is also the question somebody actually comes here to ask — "is
                      anything signed in that should not be" — which the button answers. */}
                  <p className="small text-body-secondary mb-2">
                    {sessions === null
                      ? t("common.loading")
                      : t("settings.sessionsActive", { count: sessions })}
                  </p>
                  <CButton
                    color="danger"
                    variant="outline"
                    size="sm"
                    disabled={endingSessions}
                    onClick={endEverywhere}
                  >
                    {endingSessions && <CSpinner size="sm" className="me-2" />}
                    {t("settings.endEverywhere")}
                  </CButton>
                  <CFormText className="d-block mt-1">
                    {t("settings.endEverywhereHint")}
                  </CFormText>
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
