"use client";

import { useState } from "react";
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CSpinner,
} from "@coreui/react";

import { usersApi } from "@/lib/api/endpoints";
import { useT } from "@/lib/i18n";
import { notify } from "@/lib/ui/toast-store";

type Way = "invite" | "password";

/**
 * Adding somebody, by either of the two ways in.
 *
 * Until this worked, the modal it replaces did nothing at all: its send button only closed
 * the window, the fields were never bound to anything, and `usersApi.invite` was never
 * called. That mattered more once open registration was removed, because it left no
 * working way to add a user at all.
 *
 * **Invite** sends a link and the person chooses their own password, which nobody else
 * ever knows. It needs mail, and is refused outright if mail cannot deliver — an
 * invitation nobody hears about is worse than a refusal.
 *
 * **Password** is the administrator choosing one. It needs nothing but the database, which
 * makes it the way in when mail is not working — and that is exactly what makes requiring
 * mail for the other one safe.
 */
export default function AddUserModal({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useT();
  const [way, setWay] = useState<Way>("invite");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const emailLooksRight = /^\S+@\S+\.\S+$/.test(email);
  const ready = way === "invite"
    ? emailLooksRight
    : emailLooksRight && fullName.trim().length >= 3 && password.length >= 12;

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("viewer");
    setFailure(null);
  }

  async function submit() {
    if (!ready) return;

    setBusy(true);
    setFailure(null);
    try {
      if (way === "invite") {
        await usersApi.invite({ email, role });
        notify.success("users.invite.sent");
      } else {
        await usersApi.create({ fullName, email, role, password });
        notify.success("users.created");
      }

      reset();
      onAdded();
      onClose();
    } catch (error) {
      // Shown in the modal rather than as a toast: the form is still open and still holds
      // what was typed, and "the mail settings are wrong" is something to read next to the
      // thing it refused.
      setFailure(error instanceof Error ? error.message : t("tools.run.unexpected"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>{t("users.add")}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CNav variant="tabs" className="mb-3">
          <CNavItem>
            <CNavLink active={way === "invite"} onClick={() => setWay("invite")} role="button">
              {t("users.add.invite")}
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={way === "password"} onClick={() => setWay("password")} role="button">
              {t("users.add.password")}
            </CNavLink>
          </CNavItem>
        </CNav>

        <p className="small text-body-secondary">
          {way === "invite" ? t("users.add.inviteHint") : t("users.add.passwordHint")}
        </p>

        {failure && <CAlert color="danger" className="py-2 small">{failure}</CAlert>}

        <CForm className="row g-3">
          {way === "password" && (
            <div className="col-12">
              <CFormLabel htmlFor="add-name">{t("register.fullName")}</CFormLabel>
              <CFormInput
                id="add-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
          )}

          <div className="col-12">
            <CFormLabel htmlFor="add-email">{t("users.invite.email")}</CFormLabel>
            <CFormInput
              id="add-email"
              type="email"
              value={email}
              placeholder="ad@acme.dev"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="col-12">
            <CFormLabel htmlFor="add-role">{t("users.column.role")}</CFormLabel>
            <CFormSelect
              id="add-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="viewer">{t("users.role.viewer")}</option>
              <option value="developer">{t("users.role.developer")}</option>
              <option value="admin">{t("users.role.admin")}</option>
            </CFormSelect>
          </div>

          {way === "password" && (
            <div className="col-12">
              <CFormLabel htmlFor="add-password">{t("login.password")}</CFormLabel>
              <CFormInput
                id="add-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <CFormText>{t("users.add.passwordRule")}</CFormText>
            </div>
          )}
        </CForm>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </CButton>
        <CButton color="primary" onClick={submit} disabled={!ready || busy}>
          {busy && <CSpinner size="sm" className="me-2" />}
          {way === "invite" ? t("users.invite.send") : t("users.add.create")}
        </CButton>
      </CModalFooter>
    </CModal>
  );
}
