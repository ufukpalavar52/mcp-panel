"use client";

import { useState } from "react";
import { Terminal } from "@/components/ui/Terminal";
import CIcon from "@coreui/icons-react";
import { cilCheckAlt, cilCopy } from "@coreui/icons";
import {
  CBadge,
  CButton,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import { useT } from "@/lib/i18n";
import { successfulText } from "@/lib/results";
import { notify } from "@/lib/ui/toast-store";
import type { RunPayload } from "@/lib/api/types";

type Target = RunPayload["targets"][number];

/** Cells are values, not markup: whatever the database held is shown as text. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * A query's answer, drawn as a table.
 *
 * The rows arrive structured, so the columns come from the first row's keys rather than
 * from splitting text on runs of spaces — a cell containing two spaces would have taken
 * that apart, and a person reading a report would have had no way to tell.
 */
export function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const t = useT();

  if (rows.length === 0) {
    // An answer, not a failure. A blank space here reads as something having gone wrong.
    return <div className="small text-body-secondary mt-1">{t("console.outcome.noRows")}</div>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="mt-1">
      {/* Scrolls inside itself: a wide result must not push the page sideways. */}
      <div className="table-responsive border rounded-3">
        <CTable small hover align="middle" className="mb-0">
          <CTableHead className="bg-body-tertiary">
            <CTableRow>
              {columns.map((column) => (
                <CTableHeaderCell key={column} className="small text-nowrap">
                  {column}
                </CTableHeaderCell>
              ))}
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {rows.map((row, index) => (
              <CTableRow key={index}>
                {columns.map((column) => {
                  const value = row[column];

                  return (
                    <CTableDataCell
                      key={column}
                      className={`small mono ${value === null ? "text-body-secondary" : ""}`}
                      style={{ maxWidth: 320 }}
                    >
                      <span className="d-inline-block text-truncate w-100" title={cell(value)}>
                        {cell(value)}
                      </span>
                    </CTableDataCell>
                  );
                })}
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>

      <div className="small text-body-secondary mt-1">
        {t("console.outcome.rowCount", { count: rows.length })}
      </div>
    </div>
  );
}

/**
 * What one target produced.
 *
 * Shared by the console, which watches a run it just started, and the history screen,
 * which looks at one that finished an hour ago. The same result should not look like two
 * different things depending on where it is read.
 */
/** What the endpoint actually answered, folded away under the table drawn from it. */
function RawBody({ body }: { body: string }) {
  const t = useT();

  return (
    <details className="mt-1">
      <summary className="small text-body-secondary" style={{ cursor: "pointer" }}>
        {t("runs.rawBody")}
      </summary>
      <Terminal className="mt-1">{body}</Terminal>
    </details>
  );
}

/**
 * Puts a run's answer on the clipboard.
 *
 * Only what succeeded, and only when there is something to take: a button that copies an
 * empty string looks broken in exactly the way a button that does nothing does.
 *
 * The clipboard can refuse — a browser with the permission denied, a page served over
 * plain http — and it says so rather than pretending. Silence after pressing copy is how
 * somebody pastes the thing they copied ten minutes ago into a report.
 */
export function CopyResults({ targets }: { targets: Target[] }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const text = successfulText(targets);

  if (!text) {
    return null;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FOR_MS);
    } catch {
      notify.failure(t("runs.copyFailed"));
    }
  };

  return (
    <CButton color="secondary" variant="outline" size="sm" onClick={copy}>
      <CIcon icon={copied ? cilCheckAlt : cilCopy} size="sm" className="me-1" />
      {copied ? t("runs.copied") : t("runs.copy")}
    </CButton>
  );
}

/** How long the button admits to having done something. */
const COPIED_FOR_MS = 2000;

/**
 * What a command's exit code says, in the one glance somebody gives it.
 *
 * Shown at all is the change. A target could come back failed with its code sitting in the
 * payload and nothing on screen said so — the output was there to be read, and whether the
 * thing had worked was left to be inferred from it.
 */
function ExitCode({ target }: { target: Target }) {
  const t = useT();

  if (target.exitCode == null) {
    return null;
  }

  const ok = target.exitCode === 0;

  return (
    <CBadge color={ok ? "success" : "danger"} className="mono">
      {t("runs.exitCode", { code: target.exitCode })}
    </CBadge>
  );
}

export function TargetResult({ target }: { target: Target }) {
  const t = useT();

  return (
    <div className="mb-2">
      {/* Named even when there is one: a fleet command has several, and the same
          component shows both. */}
      <div className="small text-body-secondary d-flex flex-wrap align-items-center gap-2 mb-1">
        <span className="mono fw-semibold text-body">{target.address}</span>
        <ExitCode target={target} />
        {target.durationMs != null && <span>{target.durationMs} ms</span>}
      </div>

      {/* Rows first: when a query returned any, the table is the answer and the
          flattened text beside it is the same thing spelled out in spaces.

          Length, not truthiness. An empty array is truthy, so every SSH command — which
          has no rows at all — took this branch and had "no rows" drawn over the top of the
          output it did produce. A table with nothing in it is a query's answer; it is
          never a command's. */}
      {target.rows && target.rows.length > 0 ? (
        <>
          <ResultTable rows={target.rows} />

          {/* The table is read from the answer, not the answer itself. A listing endpoint
              puts a count and its paging beside the rows, and drawing only the rows would
              quietly throw that away — so what came back stays one click below. */}
          {target.stdoutExcerpt && <RawBody body={target.stdoutExcerpt} />}
        </>
      ) : target.stdoutExcerpt ? (
        <Terminal className="mt-1">{target.stdoutExcerpt}</Terminal>
      ) : (
        target.rows && <ResultTable rows={target.rows} />
      )}

      {target.stderrExcerpt && (
        <div className="mt-1">
          <div className="small text-danger-emphasis mb-1">{t("runs.stderr")}</div>
          <Terminal kind="error">{target.stderrExcerpt}</Terminal>
        </div>
      )}
    </div>
  );
}
