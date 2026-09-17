"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CIcon from "@coreui/icons-react";
import { cilEnvelopeClosed, cilLockLocked } from "@coreui/icons";
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CForm,
  CFormCheck,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CSpinner,
} from "@coreui/react";
import { useT } from "@/lib/i18n";
import { authApi } from "@/lib/api/endpoints";
import { ApiRequestError } from "@/lib/api/errors";
import { setSession } from "@/lib/auth/session-store";

export default function LoginForm() {
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(email);
  const passwordValid = password.length >= 8;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);

    if (!emailValid || !passwordValid) return;

    setLoading(true);
    try {
      const auth = await authApi.login(email, password);

      setSession({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        user: {
          id: auth.user.id,
          email: auth.user.email,
          fullName: auth.user.fullName,
          role: auth.user.role,
          status: auth.user.status,
          team: auth.user.team,
          avatarUrl: auth.user.avatarUrl,
        },
      });
      router.replace("/dashboard");
    } catch (cause) {
      // A 401 is the expected outcome of a wrong password, so it gets the neutral
      // message; anything else is worth showing verbatim, it is usually connectivity.
      setError(
        cause instanceof ApiRequestError && cause.status === 401
          ? t("login.failed")
          : cause instanceof Error
            ? cause.message
            : t("login.failed"),
      );
      setLoading(false);
    }
  }

  return (
    <CCard className="auth-card shadow-sm">
      <CCardBody className="p-4 p-sm-5">
        <div className="mb-4">
          <h1 className="h3 fw-semibold mb-1">{t("login.title")}</h1>
          <p className="text-body-secondary mb-0 small">
            {t("login.subtitle")}
          </p>
        </div>

        {error && (
          <CAlert color="danger" className="py-2 small">
            {error}
          </CAlert>
        )}

        <CForm noValidate onSubmit={handleSubmit}>
          <div className="mb-3">
            <CFormLabel htmlFor="email">{t("login.email")}</CFormLabel>
            <CInputGroup className="has-validation">
              <CInputGroupText>
                <CIcon icon={cilEnvelopeClosed} />
              </CInputGroupText>
              <CFormInput
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ad@sirket.com"
                value={email}
                invalid={submitted && !emailValid}
                onChange={(event) => setEmail(event.target.value)}
              />
              <CFormFeedback invalid>{t("login.emailInvalid")}</CFormFeedback>
            </CInputGroup>
          </div>

          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center">
              <CFormLabel htmlFor="password">{t("login.password")}</CFormLabel>
              <Link
                href="/login"
                className="small text-decoration-none mb-2"
              >
                {t("login.forgot")}
              </Link>
            </div>
            <CInputGroup className="has-validation">
              <CInputGroupText>
                <CIcon icon={cilLockLocked} />
              </CInputGroupText>
              <CFormInput
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                invalid={submitted && !passwordValid}
                onChange={(event) => setPassword(event.target.value)}
              />
              <CButton
                type="button"
                color="secondary"
                variant="outline"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? t("login.hidePassword") : t("login.showPassword")
                }
              >
                {showPassword ? t("login.hide") : t("login.show")}
              </CButton>
              <CFormFeedback invalid>
                {t("login.passwordInvalid")}
              </CFormFeedback>
            </CInputGroup>
          </div>

          <div className="d-flex align-items-center justify-content-between mb-4">
            <CFormCheck id="remember" label={t("login.remember")} defaultChecked />
          </div>

          <CButton
            type="submit"
            color="primary"
            className="w-100 py-2"
            disabled={loading}
          >
            {loading && <CSpinner size="sm" className="me-2" />}
            {t("login.submit")}
          </CButton>
        </CForm>

      </CCardBody>
    </CCard>
  );
}
