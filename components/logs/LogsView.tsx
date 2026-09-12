"use client";

import { useMemo, useState } from "react";
import {
  CBadge,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormSelect,
  CNav,
  CNavItem,
  CNavLink,
  CPagination,
  CPaginationItem,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import ResourceState from "@/components/ResourceState";
import { logLevelColor, type LogLevel } from "@/lib/data";
import { useLogCounts, useLogSearch } from "@/lib/api/logs-store";
import { useDefinitions } from "@/lib/definitions-store";
import { useIntlLocale, useT, type MessageKey } from "@/lib/i18n";

const levelTabs: { value: LogLevel | "all"; labelKey: MessageKey }[] = [
  { value: "all", labelKey: "logs.tab.all" },
  { value: "error", labelKey: "logs.tab.error" },
  { value: "warn", labelKey: "logs.tab.warn" },
  { value: "info", labelKey: "logs.tab.info" },
];

export default function LogsView() {
  const definitions = useDefinitions();
  const t = useT();
  const intlLocale = useIntlLocale();

  // Tool names come from the definitions the panel already has; the log rows
  // themselves are paged server side, so they cannot supply the filter list.
  const toolNames = useMemo(
    () => definitions.map((definition) => definition.toolName).sort(),
    [definitions],
  );

  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [tool, setTool] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const counts = useLogCounts();
  const result = useLogSearch({
    level: level === "all" ? undefined : level,
    tool: tool === "all" ? undefined : tool,
    search: query.trim() || undefined,
    page,
  });

  return (
    <>
      <PageHeader
        title={t("logs.title")}
        description={t("logs.subtitle")}
      />

      <CCard className="mb-4">
        <CCardBody className="pb-0">
          <CNav variant="underline-border" className="mb-3">
            {levelTabs.map((tab) => (
              <CNavItem key={tab.value}>
                <CNavLink
                  href="#"
                  active={level === tab.value}
                  onClick={(event) => {
                    event.preventDefault();
                    setLevel(tab.value);
                    setPage(0);
                  }}
                >
                  {t(tab.labelKey)}
                  <CBadge
                    color="secondary"
                    shape="rounded-pill"
                    className="ms-2"
                  >
                    {counts[tab.value] ?? 0}
                  </CBadge>
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          <CRow className="g-2 pb-3">
            <CCol md={6}>
              <CFormInput
                placeholder={t("logs.searchPlaceholder")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                aria-label={t("logs.searchLabel")}
              />
            </CCol>
            <CCol md={4}>
              <CFormSelect
                value={tool}
                onChange={(event) => {
                  setTool(event.target.value);
                  setPage(0);
                }}
                aria-label={t("logs.filterByTool")}
              >
                <option value="all">{t("logs.allTools")}</option>
                {toolNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* The shared state component, for the reason it exists: this page asked the
          gateway, got a 503 and rendered "no records" — a broken backend and an empty log
          are the same picture, and the tab badges above still said 41. */}
      <ResourceState
        loading={result.loading}
        error={result.error}
        empty={result.entries.length === 0}
        onRetry={result.reload}
        emptyMessage={t("logs.empty")}
      >
        <CCard>
          <CCardBody className="pt-2">
            <CTable align="middle" hover responsive small className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 90 }}>
                    {t("logs.column.time")}
                  </CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 90 }}>
                    {t("logs.column.level")}
                  </CTableHeaderCell>
                  <CTableHeaderCell>{t("logs.column.tool")}</CTableHeaderCell>
                  <CTableHeaderCell>{t("logs.column.caller")}</CTableHeaderCell>
                  <CTableHeaderCell className="text-end">
                    {t("logs.column.duration")}
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    {t("logs.column.message")}
                  </CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {result.entries.map((log) => (
                  <CTableRow key={log.id}>
                    <CTableDataCell className="mono small text-body-secondary">
                      {new Date(log.createdAt).toLocaleTimeString(intlLocale)}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge
                        color={logLevelColor[log.level]}
                        shape="rounded-pill"
                        className="text-uppercase"
                      >
                        {log.level}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell className="mono small">
                      <div className="fw-semibold">{log.toolName}</div>
                      <div className="text-body-secondary">
                        {log.modelLabel}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell className="small mono">
                      {log.actorLabel}
                    </CTableDataCell>
                    <CTableDataCell className="text-end mono small">
                      {log.durationMs.toLocaleString(intlLocale)} ms
                    </CTableDataCell>
                    <CTableDataCell className="small">
                      {log.message}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </ResourceState>

      <div className="d-flex justify-content-between align-items-center mt-3">
        <span className="small text-body-secondary">
          {t("common.rows", { count: result.totalElements })}
        </span>
        <CPagination aria-label={t("logs.pages")} className="mb-0">
          <CPaginationItem
            disabled={page === 0}
            role="button"
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            {t("common.previous")}
          </CPaginationItem>
          <CPaginationItem active>{page + 1}</CPaginationItem>
          <CPaginationItem
            disabled={result.isLast}
            role="button"
            onClick={() => setPage((current) => current + 1)}
          >
            {t("common.next")}
          </CPaginationItem>
        </CPagination>
      </div>
    </>
  );
}
