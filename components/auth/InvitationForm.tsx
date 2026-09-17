"use client";

import { useState } from "react";
import CIcon from "@coreui/icons-react";
import { cilLockLocked, cilUser } from "@coreui/icons";
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
  CProgress,
  CSpinner,
} from "@coreui/react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { authApi } from "@/lib/api/endpoints";
import { setSession } from "@/lib/auth/session-store";

function strengthOf(password: string) {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;
  if (/[A-ZĞÜŞİÖÇ]/.test(password) && /[a-zğüşıöç]/.test(password)) score += 25;
  if (/\d/.test(password) && /[^\w\s]/.test(password)) score += 25;
  return score;
}

export default function InvitationForm({ token }: { token: string }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    terms: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const router = useRouter();

  const score = strengthOf(form.password);
  const strengthColor =
    score >= 75 ? "success" : score >= 50 ? "warning" : "danger";
  const strengthLabel =
    score >= 75
      ? t("register.strength.strong")
      : score >= 50
        ? t("register.strength.medium")
        : t("register.strength.weak");

  const valid = {
    name: form.name.trim().length >= 3,
    password: score >= 50,
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);

    if (!Object.values(valid).every(Boolean)) return;

    setLoading(true);
    try {
      const auth = await authApi.acceptInvitation(token, form.name, form.password);

      // The gateway signs the new account in straight away, so there is no second
      // login step; the confirmation screen is shown before redirecting.
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
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("login.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CCard className="auth-card shadow-sm">
      <CCardBody className="p-4 p-sm-5">
        <div className="mb-4">
          <h1 className="h3 fw-semibold mb-1">{t("invitation.title")}</h1>
          <p className="text-body-secondary mb-0 small">
            {t("invitation.subtitle")}
          </p>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="fs-1">🎉</div>
            <h2 className="h5 fw-semibold mt-2">{t("invitation.createdTitle")}</h2>
            <p className="text-body-secondary small">
              {t("invitation.created")}
            </p>
            <button
              type="button"
              className="btn btn-primary mt-2"
              onClick={() => router.replace("/dashboard")}
            >
              {t("invitation.continue")}
            </button>
          </div>
        ) : (
          <>
            {error && (
              <CAlert color="danger" className="py-2 small">
                {error}
              </CAlert>
            )}
            <CForm noValidate onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormLabel htmlFor="reg-name">{t("register.fullName")}</CFormLabel>
                <CInputGroup className="has-validation">
                  <CInputGroupText>
                    <CIcon icon={cilUser} />
                  </CInputGroupText>
                  <CFormInput
                    id="reg-name"
                    value={form.name}
                    invalid={submitted && !valid.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                  <CFormFeedback invalid>{t("register.nameInvalid")}</CFormFeedback>
                </CInputGroup>
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="reg-password">{t("login.password")}</CFormLabel>
                <CInputGroup className="has-validation">
                  <CInputGroupText>
                    <CIcon icon={cilLockLocked} />
                  </CInputGroupText>
                  <CFormInput
                    id="reg-password"
                    type="password"
                    value={form.password}
                    invalid={submitted && !valid.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                  />
                  <CFormFeedback invalid>
                    {t("register.passwordWeak")}
                  </CFormFeedback>
                </CInputGroup>
                {form.password && (
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <CProgress
                      value={score}
                      color={strengthColor}
                      height={4}
                      className="flex-grow-1"
                    />
                    <span className={`small text-${strengthColor}`}>
                      {strengthLabel}
                    </span>
                  </div>
                )}
              </div>


              <CButton
                type="submit"
                color="primary"
                className="w-100 py-2"
                disabled={loading}
              >
                {loading && <CSpinner size="sm" className="me-2" />}
                {t("invitation.submit")}
              </CButton>
            </CForm>
          </>
        )}
      </CCardBody>
    </CCard>
  );
}
