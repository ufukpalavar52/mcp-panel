"use client";

import { useState } from "react";
import Link from "next/link";
import CIcon from "@coreui/icons-react";
import { cilEnvelopeClosed } from "@coreui/icons";
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CSpinner,
} from "@coreui/react";

import { authApi } from "@/lib/api/endpoints";
import { useT } from "@/lib/i18n";

/**
 * Asking for a reset link.
 *
 * The answer is the same whether the address has an account or not, and the screen says so
 * in those words. Anything more specific — "no account with that address" — would turn the
 * login page into a way of finding out which addresses exist, and it is open to anybody.
 */
export default function ForgotPasswordForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const valid = /^\S+@\S+\.\S+$/.test(email);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;

    setBusy(true);
    setFailure(null);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (error) {
      // A mail host that is down is the operator's problem, not a hint about the address.
      setFailure(error instanceof Error ? error.message : t("forgot.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CCard className="auth-card shadow-sm">
      <CCardBody className="p-4 p-sm-5">
        <h1 className="h4 fw-semibold mb-1">{t("forgot.title")}</h1>

        {sent ? (
          <>
            <p className="text-body-secondary small">{t("forgot.sent")}</p>
            <Link href="/login" className="small text-decoration-none">
              {t("forgot.backToLogin")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-body-secondary small">{t("forgot.subtitle")}</p>

            {failure && <CAlert color="danger" className="py-2 small">{failure}</CAlert>}

            <CForm noValidate onSubmit={submit}>
              <div className="mb-3">
                <CFormLabel htmlFor="forgot-email">{t("login.email")}</CFormLabel>
                <CInputGroup>
                  <CInputGroupText><CIcon icon={cilEnvelopeClosed} /></CInputGroupText>
                  <CFormInput
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </CInputGroup>
              </div>

              <CButton color="primary" type="submit" disabled={busy || !valid} className="w-100">
                {busy && <CSpinner size="sm" className="me-2" />}
                {t("forgot.submit")}
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
