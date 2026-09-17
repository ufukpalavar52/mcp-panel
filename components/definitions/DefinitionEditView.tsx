"use client";

import Link from "next/link";
import CIcon from "@coreui/icons-react";
import { cilWarning } from "@coreui/icons";
import { CButton, CCard, CCardBody, CSpinner } from "@coreui/react";
import AccessPanel from "./AccessPanel";
import DefinitionForm from "./DefinitionForm";
import { useSession } from "@/lib/auth/session-store";
import { useDefinition } from "@/lib/definitions-store";
import { useT } from "@/lib/i18n";

/**
 * Loads one definition for editing.
 *
 * The list only carries summaries, so the full document with its actions is fetched
 * here; the three outcomes of that request each get their own screen.
 */
export default function DefinitionEditView({ id }: { id: string }) {
  const role = useSession()?.user.role;
  const t = useT();
  const numericId = Number(id);
  const { definition, loading, error } = useDefinition(numericId);

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    );
  }

  if (error || !definition) {
    return (
      <CCard>
        <CCardBody className="text-center py-5">
          <CIcon icon={cilWarning} size="xl" className="text-warning mb-2 d-block mx-auto" />
          <h1 className="h5 fw-semibold">{t("definitions.notFound")}</h1>
          <p className="text-body-secondary small">
            {t("definitions.notFoundBody", { id })}
          </p>
          <CButton color="primary" as={Link} href="/definitions">
            {t("definitions.backToList")}
          </CButton>
        </CCardBody>
      </CCard>
    );
  }

  // key: switching to another definition must rebuild the form state from scratch.
  return (
    <>
      <DefinitionForm key={definition.id} initial={definition} mode="edit" />

      {/* Below the form rather than beside it: who may reach a definition is a question
          somebody asks after they have decided what it does, and it is answered far less
          often than the rest of this screen is edited.

          Administrators only — the endpoint says so too. Somebody who may edit a definition
          can already change what it does, but deciding who *else* gets to is a different
          kind of act, and leaving it with the role would let anybody holding it hand
          themselves what they were not given. */}
      {role === "admin" && (
        <div className="mt-4">
          <AccessPanel definitionId={definition.id} />
        </div>
      )}
    </>
  );
}
