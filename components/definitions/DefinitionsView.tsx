"use client";

import { useState } from "react";
import Link from "next/link";
import CIcon from "@coreui/icons-react";
import {
  cilClone,
  cilOptions,
  cilPencil,
  cilPlus,
  cilTrash,
} from "@coreui/icons";
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CDropdown,
  CDropdownDivider,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormSwitch,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import { actionIcons } from "./ActionEditor";
import { actionKindColors, actionKindKeys, type ActionKind } from "@/lib/definitions";
import type { DefinitionSummary } from "@/lib/definitions-store";
import {
  useDefinitionActions,
  useDefinitions,
  useDefinitionsStatus,
} from "@/lib/definitions-store";
import ResourceState from "@/components/ResourceState";
import { useIntlLocale, useT } from "@/lib/i18n";

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DefinitionsView() {
  const definitions = useDefinitions();
  const status = useDefinitionsStatus();
  const t = useT();
  const intlLocale = useIntlLocale();
  const { remove, toggle, duplicate } = useDefinitionActions();
  const [pendingDelete, setPendingDelete] = useState<DefinitionSummary | null>(null);

  return (
    <>
      <PageHeader
        title={t("definitions.title")}
        description={t("definitions.subtitle")}
        actions={
          <CButton color="primary" as={Link} href="/definitions/new">
            <CIcon icon={cilPlus} className="me-2" />
            {t("definitions.new")}
          </CButton>
        }
      />

      <ResourceState
        loading={status.loading}
        error={status.error}
        empty={definitions.length === 0}
        onRetry={status.reload}
        emptyMessage={t("definitions.empty")}
        emptyAction={
          <CButton color="primary" as={Link} href="/definitions/new">
            <CIcon icon={cilPlus} className="me-2" />
            {t("definitions.createFirst")}
          </CButton>
        }
      >
      <CCard>
        <CCardBody className="pt-2">
          <CTable align="middle" hover responsive className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>{t("definitions.column.definition")}</CTableHeaderCell>
                <CTableHeaderCell>{t("common.model")}</CTableHeaderCell>
                <CTableHeaderCell>{t("common.actions")}</CTableHeaderCell>
                <CTableHeaderCell className="text-end">{t("common.inputs")}</CTableHeaderCell>
                <CTableHeaderCell>{t("common.status")}</CTableHeaderCell>
                <CTableHeaderCell className="text-end">
                  {t("common.updated")}
                </CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {definitions.map((definition) => {
                const counts = definition.actionCountsByKind;

                return (
                  <CTableRow key={definition.id}>
                    <CTableDataCell>
                      <Link
                        href={`/definitions/${definition.id}`}
                        className="fw-semibold text-decoration-none"
                      >
                        {definition.name}
                      </Link>
                      <div
                        className="small text-body-secondary text-truncate"
                        style={{ maxWidth: 320 }}
                      >
                        {definition.toolDescription}
                      </div>
                    </CTableDataCell>

                    <CTableDataCell className="mono small">
                      {definition.modelIdentifier ?? (
                        <span className="text-danger">{t("common.notSelected")}</span>
                      )}
                    </CTableDataCell>

                    <CTableDataCell>
                      <div className="d-flex gap-1 flex-wrap">
                        {(Object.keys(counts) as ActionKind[]).map((kind) => (
                          <CBadge
                            key={kind}
                            color={actionKindColors[kind]}
                            shape="rounded-pill"
                            title={t(actionKindKeys[kind])}
                          >
                            <CIcon
                              icon={actionIcons[kind]}
                              size="sm"
                              className="me-1"
                            />
                            {counts[kind]}
                          </CBadge>
                        ))}
                        {Object.keys(counts).length === 0 && (
                          <span className="small text-body-secondary">—</span>
                        )}
                      </div>
                    </CTableDataCell>

                    <CTableDataCell className="text-end mono">
                      {definition.inputCount}
                    </CTableDataCell>

                    <CTableDataCell>
                      <CFormSwitch
                        id={`toggle-${definition.id}`}
                        checked={definition.enabled}
                        onChange={() => toggle(definition.id)}
                        label={
                          <span className="small">
                            {definition.enabled
                              ? t("common.enabled")
                              : t("common.disabled")}
                          </span>
                        }
                      />
                    </CTableDataCell>

                    <CTableDataCell className="text-end small text-body-secondary">
                      {formatDate(definition.updatedAt, intlLocale)}
                    </CTableDataCell>

                    <CTableDataCell className="text-end">
                      {/* portal: the row sits inside .table-responsive, whose overflow-x clips anything
                            that leaves the box. With one row the box is short, so the menu opened
                            below the visible area and had to be scrolled to. A portal takes the
                            menu out of that container entirely. */}
                      <CDropdown alignment="end" variant="btn-group" portal>
                        <CDropdownToggle
                          color="light"
                          size="sm"
                          caret={false}
                          aria-label={t("definitions.actionsLabel")}
                        >
                          <CIcon icon={cilOptions} />
                        </CDropdownToggle>
                        <CDropdownMenu>
                          <CDropdownItem
                            as={Link}
                            href={`/definitions/${definition.id}`}
                          >
                            <CIcon icon={cilPencil} className="me-2" />
                            {t("common.edit")}
                          </CDropdownItem>
                          <CDropdownItem
                            role="button"
                            onClick={() => duplicate(definition.id)}
                          >
                            <CIcon icon={cilClone} className="me-2" />
                            {t("common.duplicate")}
                          </CDropdownItem>
                          <CDropdownDivider />
                          <CDropdownItem
                            role="button"
                            className="text-danger"
                            onClick={() => setPendingDelete(definition)}
                          >
                            <CIcon icon={cilTrash} className="me-2" />
                            {t("common.delete")}
                          </CDropdownItem>
                        </CDropdownMenu>
                      </CDropdown>
                    </CTableDataCell>
                  </CTableRow>
                );
              })}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
      </ResourceState>

      <CModal
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>{t("definitions.delete.title")}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="mb-2">
            {t("definitions.delete.body", { name: pendingDelete?.name ?? "" })}
          </p>
          <p className="small text-body-secondary mb-0">
            {t("definitions.delete.detail", {
              actions: Object.values(pendingDelete?.actionCountsByKind ?? {}).reduce(
                (sum, count) => sum + count,
                0,
              ),
              inputs: pendingDelete?.inputCount ?? 0,
            })}
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setPendingDelete(null)}
          >
            {t("common.cancel")}
          </CButton>
          <CButton
            color="danger"
            onClick={() => {
              if (pendingDelete) remove(pendingDelete.id);
              setPendingDelete(null);
            }}
          >
            <CIcon icon={cilTrash} className="me-2" />
            {t("common.confirmDelete")}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
}
