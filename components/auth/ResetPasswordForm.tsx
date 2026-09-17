"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useT } from "@/lib/i18n";

/**
 * Setting a password against a reset link.
 *
 * No current password: not knowing it is the entire reason somebody is here. The link is
 * the authorisation, which is why it lasts an hour, works once, and takes every session of
 * that account with it when it is used.
 *
 * Signing in is left as a separate step rather than done automatically. Somebody who has
 * just reset a password because they suspected the account was taken should see the login
 * screen accept it — that is the confirmation they came for.
 */
export default function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const longEnough = password.length >= 12;
  const matches = password === confirm;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!longEnough || !matches) return;

    setBusy(true);
    setFailure(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t("reset.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CCard className="auth-card shadow-sm">
      <CCardBody className="p-4 p-sm-5">
        <h1 className="h4 fw-semibold mb-1">{t("reset.title")}</h1>

        {done ? (
          <>
            <p className="text-body-secondary small">{t("reset.done")}</p>
            <CButton color="primary" onClick={() => router.replace("/login")}>
              {t("reset.signIn")}
            </CButton>
          </>
        ) : (
          <>
            <p className="text-body-secondary small">{t("reset.subtitle")}</p>

            {failure && <CAlert color="danger" className="py-2 small">{failure}</CAlert>}

            <CForm noValidate onSubmit={submit}>
              <div className="mb-3">
                <CFormLabel htmlFor="reset-password">{t("settings.newPassword")}</CFormLabel>
                <CInputGroup className="has-validation">
                  <CInputGroupText><CIcon icon={cilLockLocked} /></CInputGroupText>
                  <CFormInput
                    id="reset-password"
                    type="password"
                    value={password}
                    invalid={password.length > 0 && !longEnough}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <CFormFeedback invalid>{t("settings.passwordRule")}</CFormFeedback>
                </CInputGroup>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="reset-confirm">{t("settings.confirmPassword")}</CFormLabel>
                <CInputGroup className="has-validation">
                  <CInputGroupText><CIcon icon={cilLockLocked} /></CInputGroupText>
                  <CFormInput
                    id="reset-confirm"
                    type="password"
                    value={confirm}
                    invalid={confirm.length > 0 && !matches}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                  <CFormFeedback invalid>{t("settings.passwordMismatch")}</CFormFeedback>
                </CInputGroup>
              </div>

              <CButton
                color="primary"
                type="submit"
                disabled={busy || !longEnough || !matches}
                className="w-100"
              >
                {busy && <CSpinner size="sm" className="me-2" />}
                {t("reset.submit")}
              </CButton>
            </CForm>

            <div className="mt-3">
              <Link href="/login" className="small text-decoration-none">
                {t("forgot.backToLogin")}
              </Link>
            </div>
          </>
        )}
      </CCardBody>
    </CCard>
  );
}
