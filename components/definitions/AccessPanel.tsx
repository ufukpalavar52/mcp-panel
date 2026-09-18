"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CSpinner,
} from "@coreui/react";

import { definitionAccessApi, usersApi } from "@/lib/api/endpoints";
import { useT } from "@/lib/i18n";
import { notify } from "@/lib/ui/toast-store";
import type { DefinitionAccessPayload, UserPayload } from "@/lib/api/types";

type Grant = DefinitionAccessPayload["permissions"][number];

/**
 * How many people the search offers at a time.
 *
 * Ten because a list of everybody is not a thing anybody reads: the screen exists to find
 * the two or three people who should reach this definition, not to scroll past the rest.
 * Anybody already granted is shown as well, however many that is.
 */
const SHOWN = 10;

/**
 * Who may reach this definition.
 *
 * <p>Until this screen existed, authorisation was the role alone: anybody with DEVELOPER
 * could run every published tool, including one carrying `allowedCommands: ["*"]` and sudo.
 *
 * The mode is a switch rather than something inferred from an empty list. Removing the last
 * person from a restricted definition leaves it restricted and unreachable — which is a
 * state somebody arrived at deliberately. The alternative quietly reopens it to the whole
 * installation and nothing on the screen changes.
 */
export default function AccessPanel({ definitionId }: { definitionId: number }) {
  const t = useT();
  const [access, setAccess] = useState<DefinitionAccessPayload | null>(null);
  const [found, setFound] = useState<UserPayload[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    definitionAccessApi.get(definitionId)
      .then((current) => {
        if (!cancelled) setAccess(current);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFailure(error instanceof Error ? error.message : t("tools.run.unexpected"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [definitionId, t]);

  // Searched on the server and asked for ten. Filtering a page the server already
  // truncated would search the first hundred accounts and quietly call that the answer —
  // which fails at exactly the size that makes a search worth having.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      usersApi.list(0, SHOWN, search)
        .then((people) => {
          if (cancelled) return;
          setFound(people.content);
          setTotal(people.totalElements);
        })
        .catch(() => {
          if (!cancelled) setFound([]);
        });
    }, search ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const grantFor = useCallback(
    (userId: number): Grant =>
      access?.permissions.find((row) => row.userId === userId)
      ?? { userId, canRun: false, canEdit: false },
    [access],
  );

  /**
   * Who to draw a row for.
   *
   * Everybody already granted, whatever the search says, and then the search results that
   * are not among them. Hiding a granted person behind a search would leave an access
   * somebody cannot see and therefore cannot take away — the list would be editing a state
   * it was not showing.
   */
  const rows: Grant[] = access
    ? [
        ...access.permissions,
        ...found
          .filter((user) => !access.permissions.some((row) => row.userId === user.id))
          .map((user) => ({
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            canRun: false,
            canEdit: false,
          })),
      ]
    : [];

  function change(userId: number, patch: Partial<Grant>) {
    if (!access) return;

    const next = { ...grantFor(userId), ...patch };

    // Edit carries run with it, and the boxes say so rather than leaving somebody to
    // discover it: ticking edit ticks run, and clearing run clears edit — otherwise the
    // screen would show a state ("may edit, may not run") the server does not honour.
    if (patch.canEdit === true) next.canRun = true;
    if (patch.canRun === false) next.canEdit = false;

    setAccess({
      ...access,
      permissions: [
        ...access.permissions.filter((row) => row.userId !== userId),
        next,
      ].filter((row) => row.canRun || row.canEdit),
    });
  }

  async function save() {
    if (!access) return;

    setSaving(true);
    setFailure(null);
    try {
      setAccess(await definitionAccessApi.replace(definitionId, access));
      // A key, not a rendered string: the locale can change while the toast is on
      // screen, and a key resolved at render time follows it.
      notify.success("toast.saved");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t("tools.run.unexpected"));
    } finally {
      setSaving(false);
    }
  }

  if (failure && !access) {
    return <CAlert color="danger" className="small">{failure}</CAlert>;
  }

  if (!access) {
    return (
      <div className="small text-body-secondary d-flex align-items-center gap-2">
        <CSpinner size="sm" />
        {t("common.loading")}
      </div>
    );
  }

  const restricted = access.access === "RESTRICTED";

  return (
    <CCard className="shadow-sm">
      <CCardBody>
        <h2 className="h6 fw-semibold mb-1">{t("access.title")}</h2>
        <p className="small text-body-secondary">{t("access.hint")}</p>

        <CFormSelect
          className="mb-3"
          value={access.access}
          aria-label={t("access.mode")}
          onChange={(event) =>
            setAccess({
              ...access,
              access: event.target.value as DefinitionAccessPayload["access"],
            })
          }
        >
          <option value="OPEN">{t("access.open")}</option>
          <option value="RESTRICTED">{t("access.restricted")}</option>
        </CFormSelect>

        {restricted && (
          <>
            {access.permissions.length === 0 && (
              // Said out loud, because it is the state people arrive at by accident and
              // then cannot explain: restricted with nobody on the list is closed.
              <CAlert color="warning" className="small py-2">
                {t("access.nobody")}
              </CAlert>
            )}

            <CFormInput
              type="search"
              className="mb-2"
              value={search}
              placeholder={t("access.searchPlaceholder")}
              aria-label={t("access.search")}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t("common.user")}</th>
                    <th className="text-center">{t("access.canRun")}</th>
                    <th className="text-center">{t("access.canEdit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.userId}>
                      <td>
                        <div className="small fw-semibold">{row.fullName}</div>
                        <div className="small text-body-secondary">{row.email}</div>
                      </td>
                      <td className="text-center">
                        <CFormCheck
                          checked={row.canRun}
                          aria-label={`${t("access.canRun")} — ${row.email}`}
                          onChange={(event) =>
                            change(row.userId, {
                              canRun: event.target.checked,
                              email: row.email,
                              fullName: row.fullName,
                            })
                          }
                        />
                      </td>
                      <td className="text-center">
                        <CFormCheck
                          checked={row.canEdit}
                          aria-label={`${t("access.canEdit")} — ${row.email}`}
                          onChange={(event) =>
                            change(row.userId, {
                              canEdit: event.target.checked,
                              email: row.email,
                              fullName: row.fullName,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > found.length && (
              // Said rather than left to be inferred from a list that simply stops.
              <p className="small text-body-secondary mt-2 mb-0">
                {t("access.more", { count: total - found.length })}
              </p>
            )}
          </>
        )}

        {failure && <CAlert color="danger" className="small mt-3 mb-0">{failure}</CAlert>}

        <div className="mt-3">
          <CButton color="primary" onClick={save} disabled={saving}>
            {saving && <CSpinner size="sm" className="me-2" />}
            {t("common.save")}
          </CButton>
        </div>
      </CCardBody>
    </CCard>
  );
}
