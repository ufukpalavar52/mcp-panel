"use client";

import { useState } from "react";
import CIcon from "@coreui/icons-react";
import { cilLockLocked } from "@coreui/icons";
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CForm,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CSpinner,
} from "@coreui/react";

import { authApi } from "@/lib/api/endpoints";
import { setSession, useSession } from "@/lib/auth/session-store";
import { useT } from "@/lib/i18n";

/**
 * The only screen an account with a borrowed password can reach.
 *
 * An administrator can create an account with a password they chose. Two people then know
 * it and only one of them owns the account — the window between that and a password only
 * its owner knows is not something to leave open out of politeness, so the panel shows
 * this and nothing else until it is closed.
 *
 * No sidebar, no header, no way past. The lock lives in AuthGuard rather than here, so
 * every route is covered by one decision instead of each page remembering to make it.
 */
export default function ForcedPasswordChange() {
  const t = useT();
  const session = useSession();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const longEnough = next.length >= 12;
  const different = next !== current;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setFailure(null);

    if (!current || !longEnough || !different) return;

    setBusy(true);
    try {
      await authApi.changePassword(current, next);

      // The flag lives on the session, and the gateway has just cleared it on its copy.
      // Rewriting it here is what releases the lock — without it the screen would stay up
      // until the next sign-in, having already done its job.
      if (session) {
        setSession({
          ...session,
          user: { ...session.user, mustChangePassword: false },
        });
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t("tools.run.unexpected"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 p-3">
      <CCard className="auth-card shadow-sm" style={{ maxWidth: 460, width: "100%" }}>
        <CCardBody className="p-4 p-sm-5">
          <h1 className="h4 fw-semibold mb-1">{t("password.title")}</h1>
          <p className="text-body-secondary small">{t("password.why")}</p>

          {failure && <CAlert color="danger" className="py-2 small">{failure}</CAlert>}

          <CForm noValidate onSubmit={submit}>
            <div className="mb-3">
              <CFormLabel htmlFor="pw-current">{t("settings.currentPassword")}</CFormLabel>
              <CInputGroup className="has-validation">
                <CInputGroupText><CIcon icon={cilLockLocked} /></CInputGroupText>
                <CFormInput
                  id="pw-current"
                  type="password"
                  value={current}
                  invalid={submitted && !current}
                  onChange={(event) => setCurrent(event.target.value)}
                />
              </CInputGroup>
            </div>

            <div className="mb-3">
              <CFormLabel htmlFor="pw-next">{t("settings.newPassword")}</CFormLabel>
              <CInputGroup className="has-validation">
                <CInputGroupText><CIcon icon={cilLockLocked} /></CInputGroupText>
                <CFormInput
                  id="pw-next"
                  type="password"
                  value={next}
                  invalid={submitted && (!longEnough || !different)}
                  onChange={(event) => setNext(event.target.value)}
                />
                <CFormFeedback invalid>
                  {longEnough ? t("password.same") : t("settings.passwordRule")}
                </CFormFeedback>
              </CInputGroup>
            </div>

            <CButton color="primary" type="submit" disabled={busy} className="w-100">
              {busy && <CSpinner size="sm" className="me-2" />}
              {t("password.submit")}
            </CButton>
          </CForm>
        </CCardBody>
      </CCard>
    </div>
  );
}
