"use client";

import { useState } from "react";
import Link from "next/link";
import CIcon from "@coreui/icons-react";
import {
  cilBan,
  cilCode,
  cilInfo,
  cilMediaPlay,
  cilPencil,
  cilPlus,
  cilPuzzle,
} from "@coreui/icons";
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardFooter,
  CCol,
  CCollapse,
  CRow,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import ResourceState from "@/components/ResourceState";
import { useT } from "@/lib/i18n";
import { useTools, useToolsStatus } from "@/lib/api/tools-store";
import ToolRunModal from "@/components/tools/ToolRunModal";
import type { ToolPayload } from "@/lib/api/types";

/**
 * Read only view of the tool surface.
 *
 * The catalogue and its JSON Schema come straight from the gateway, so what is shown
 * here is what the MCP server will publish; nothing is recomputed on the client.
 */
export default function ToolsView() {
  const t = useT();
  const tools = useTools();
  const status = useToolsStatus();
  const [openSchema, setOpenSchema] = useState<number | null>(null);
  const [running, setRunning] = useState<ToolPayload | null>(null);

  const active = tools.filter((tool) => tool.enabled).length;

  return (
    <>
      <PageHeader
        title={t("tools.title")}
        description={t("tools.subtitle")}
        actions={
          <CButton color="primary" as={Link} href="/definitions/new">
            <CIcon icon={cilPlus} className="me-2" />
            {t("definitions.new")}
          </CButton>
        }
      />

      <CAlert color="info" className="d-flex align-items-start gap-2">
        <CIcon icon={cilInfo} className="mt-1 flex-shrink-0" />
        <div className="small">{t("tools.info", { count: active })}</div>
      </CAlert>

      <ResourceState
        loading={status.loading}
        error={status.error}
        empty={tools.length === 0}
        onRetry={status.reload}
        emptyMessage={t("tools.empty")}
        emptyAction={
          <CButton color="primary" as={Link} href="/definitions/new">
            <CIcon icon={cilPlus} className="me-2" />
            {t("definitions.createFirst")}
          </CButton>
        }
      >
        <CRow className="g-3">
          {tools.map((tool) => (
            <CCol key={tool.definitionId} lg={6}>
              <CCard className="h-100">
                <CCardBody>
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="avatar-initials bg-primary-subtle text-primary">
                        <CIcon icon={cilPuzzle} />
                      </span>
                      <div className="fw-semibold mono">{tool.name}</div>
                    </div>
                    {tool.enabled ? (
                      <CBadge color="success" shape="rounded-pill">
                        {t("common.enabled")}
                      </CBadge>
                    ) : (
                      <CBadge color="secondary" shape="rounded-pill">
                        <CIcon icon={cilBan} size="sm" className="me-1" />
                        {t("common.disabled")}
                      </CBadge>
                    )}
                  </div>

                  <p className="small text-body-secondary mb-3">
                    {tool.description || (
                      <span className="fst-italic">{t("tools.noDescription")}</span>
                    )}
                  </p>

                  <div className="small text-body-secondary mb-3">
                    {t("tools.counts", {
                      actions: tool.actionCount,
                      params: Object.keys(
                        (tool.inputSchema.properties as object | undefined) ?? {},
                      ).length,
                    })}
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    <CButton
                      color="primary"
                      size="sm"
                      disabled={!tool.enabled || !tool.modelIdentifier}
                      title={
                        tool.enabled && tool.modelIdentifier
                          ? undefined
                          : t("tools.run.unavailable")
                      }
                      onClick={() => setRunning(tool)}
                    >
                      <CIcon icon={cilMediaPlay} className="me-2" />
                      {t("tools.run.open")}
                    </CButton>

                    <CButton
                      color="secondary"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setOpenSchema(
                          openSchema === tool.definitionId ? null : tool.definitionId,
                        )
                      }
                    >
                      <CIcon icon={cilCode} className="me-2" />
                      {openSchema === tool.definitionId
                        ? t("tools.hideSchema")
                        : t("tools.showSchema")}
                    </CButton>
                  </div>

                  <CCollapse visible={openSchema === tool.definitionId}>
                    <pre className="mono small bg-body-tertiary border rounded-3 p-3 mt-3 mb-0 text-body overflow-auto">
                      {JSON.stringify(
                        {
                          name: tool.name,
                          description: tool.description,
                          inputSchema: tool.inputSchema,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </CCollapse>
                </CCardBody>

                <CCardFooter className="bg-transparent d-flex align-items-center justify-content-between small">
                  <span className="text-body-secondary">
                    {tool.modelIdentifier ? (
                      <span className="mono">{tool.modelIdentifier}</span>
                    ) : (
                      <span className="text-danger">{t("tools.noModel")}</span>
                    )}
                  </span>
                  <Link
                    href={`/definitions/${tool.definitionId}`}
                    className="text-decoration-none"
                  >
                    <CIcon icon={cilPencil} size="sm" className="me-1" />
                    {t("tools.editDefinition")}
                  </Link>
                </CCardFooter>
              </CCard>
            </CCol>
          ))}
        </CRow>
      </ResourceState>

      {/* Keyed by tool so each one gets a fresh form rather than the last one's values. */}
      <ToolRunModal
        key={running?.definitionId ?? "none"}
        tool={running}
        onClose={() => setRunning(null)}
      />
    </>
  );
}
