"use client";

import { useState } from "react";
import CIcon from "@coreui/icons-react";
import { cilChevronBottom, cilChevronRight } from "@coreui/icons";
import {
  CBadge,
  CCard,
  CCardBody,
  CPagination,
  CPaginationItem,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import ResourceState from "@/components/ResourceState";
import { CopyResults, TargetResult } from "@/components/runs/ResultView";
import { useRuns } from "@/lib/api/runs-store";
import { useIntlLocale, useT, type MessageKey } from "@/lib/i18n";
import type { RunPayload } from "@/lib/api/types";

/** Every state a run can be in, with the colour and label it is shown in. */
const STATUS: Record<RunPayload["status"], { key: MessageKey; colour: string }> = {
  pending: { key: "runs.status.pending", colour: "secondary" },
  awaiting_approval: { key: "runs.status.awaitingApproval", colour: "warning" },
  running: { key: "runs.status.running", colour: "info" },
  succeeded: { key: "runs.status.succeeded", colour: "success" },
  failed: { key: "runs.status.failed", colour: "danger" },
  cancelled: { key: "runs.status.cancelled", colour: "warning" },
};

/**
 * What has actually been run.
 *
 * The gateway has kept this from the beginning and nothing showed it: a run that finished
 * after the console was closed left no trace anyone could look at, and a failure an hour
 * ago could only be found in the database.
 *
 * A row expands rather than opening its own page. What is worth reading — the statement
 * and the output — is the same thing the console shows, and a second screen to reach it
 * would be a click and a route for no extra information.
 */
export default function RunsView() {
  const t = useT();
  const intlLocale = useIntlLocale();
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const result = useRuns(page);

  return (
    <>
      <PageHeader title={t("runs.title")} description={t("runs.subtitle")} />

      <ResourceState
        loading={result.loading}
        error={result.error}
        empty={result.runs.length === 0}
        onRetry={result.reload}
        emptyMessage={t("runs.empty")}
      >
        <CCard>
          <CCardBody className="pt-2">
            <CTable align="middle" hover responsive small className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 34 }} />
                  <CTableHeaderCell style={{ width: 150 }}>
                    {t("runs.column.started")}
                  </CTableHeaderCell>
                  <CTableHeaderCell>{t("runs.column.tool")}</CTableHeaderCell>
                  <CTableHeaderCell>{t("runs.column.caller")}</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 120 }}>
                    {t("runs.column.status")}
                  </CTableHeaderCell>
                  <CTableHeaderCell className="text-end" style={{ width: 90 }}>
                    {t("runs.column.duration")}
                  </CTableHeaderCell>
                </CTableRow>
              </CTableHead>

              <CTableBody>
                {result.runs.map((run) => (
                  <Row
                    key={run.id}
                    run={run}
                    open={open === run.id}
                    locale={intlLocale}
                    onToggle={() => setOpen(open === run.id ? null : run.id)}
                  />
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
        <CPagination aria-label={t("runs.pages")} className="mb-0">
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

function Row({
  run,
  open,
  locale,
  onToggle,
}: {
  run: RunPayload;
  open: boolean;
  locale: string;
  onToggle: () => void;
}) {
  const t = useT();
  const status = STATUS[run.status];
  const duration = durationOf(run);

  return (
    <>
      <CTableRow role="button" onClick={onToggle}>
        <CTableDataCell className="text-body-secondary">
          <CIcon icon={open ? cilChevronBottom : cilChevronRight} />
        </CTableDataCell>

        <CTableDataCell className="mono small text-body-secondary">
          {run.startedAt ? new Date(run.startedAt).toLocaleString(locale) : "—"}
        </CTableDataCell>

        <CTableDataCell className="small">
          <div className="mono fw-semibold">{run.toolName ?? "—"}</div>
          <div className="text-body-secondary d-flex align-items-center gap-2">
            {run.actionName ?? "—"}
            {/* A schema read is work this stack asked for itself. Unlabelled, it looks
                like a call somebody made and cannot account for. */}
            {run.purpose === "introspect" && (
              <CBadge color="secondary" shape="rounded-pill">
                {t("runs.purpose.introspect")}
              </CBadge>
            )}
          </div>
        </CTableDataCell>

        <CTableDataCell className="small mono">{run.actorLabel || "—"}</CTableDataCell>

        <CTableDataCell>
          <CBadge color={status.colour}>{t(status.key)}</CBadge>
        </CTableDataCell>

        <CTableDataCell className="text-end mono small">
          {duration === null ? "—" : `${duration.toLocaleString(locale)} ms`}
        </CTableDataCell>
      </CTableRow>

      {open && (
        <CTableRow>
          <CTableDataCell colSpan={6} className="bg-body-tertiary">
            {run.error && (
              <div className="small text-danger-emphasis mb-2">{run.error}</div>
            )}

            {run.statement && (
              <pre className="mono small bg-body border rounded-3 p-2 mb-2 text-body overflow-auto">
                {run.statement}
              </pre>
            )}

            {run.targets.length === 0 && !run.error && (
              <div className="small text-body-secondary">{t("runs.noOutput")}</div>
            )}

            {run.targets.map((target) => (
              <TargetResult key={target.address} target={target} />
            ))}

            {run.targets.length > 0 && (
              <div className="d-flex justify-content-end mt-2">
                <CopyResults targets={run.targets} />
              </div>
            )}
          </CTableDataCell>
        </CTableRow>
      )}
    </>
  );
}

/**
 * How long the run took, from its own timestamps.
 *
 * The targets carry their own durations, but a run with several of them ran for longer
 * than any single one; taking the difference here describes the whole thing.
 */
function durationOf(run: RunPayload): number | null {
  if (!run.startedAt || !run.finishedAt) return null;

  const elapsed = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  return elapsed >= 0 ? elapsed : null;
}
