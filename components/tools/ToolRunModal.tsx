"use client";

import { useMemo, useState } from "react";
import CIcon from "@coreui/icons-react";
import {
  cilCheckCircle,
  cilMediaPlay,
  cilShieldAlt,
  cilWarning,
  cilXCircle,
} from "@coreui/icons";
import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from "@coreui/react";
import { useT } from "@/lib/i18n";
import { toolsApi } from "@/lib/api/endpoints";
import { ApiRequestError, ApiUnreachableError } from "@/lib/api/errors";
import type {
  ExecutionResultPayload,
  PlanPayload,
  PlannedActionPayload,
  ToolPayload,
} from "@/lib/api/types";

type JsonSchemaProperty = {
  type?: string;
  format?: string;
  enum?: string[];
  description?: string;
  default?: unknown;
};

type Field = JsonSchemaProperty & { key: string; required: boolean };

/**
 * Runs a tool and shows what it resolved to.
 *
 * The form is generated from the tool's own JSON Schema rather than from the definition,
 * because the schema is exactly what an MCP client sees: filling this in is the closest
 * the panel can get to being that client, and a field that only exists here would be a
 * field no real caller could send.
 *
 * Nothing is executed. The answer is a plan, and the dispatch verdict says why it stopped
 * there — which is the point of the screen: seeing the command before anything runs it.
 */
export default function ToolRunModal({
  tool,
  onClose,
}: {
  tool: ToolPayload | null;
  onClose: () => void;
}) {
  const t = useT();
  const fields = useMemo(() => readFields(tool), [tool]);

  // Seeded once per mount. The parent keys this component by tool, so opening a different
  // one remounts it and every field starts from that tool's own defaults — reopening must
  // not inherit the previous tool's answers, whose keys may coincide while meaning
  // something entirely different.
  const [values, setValues] = useState<Record<string, unknown>>(() => defaultsOf(fields));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResultPayload | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const missing = fields.filter(
    (field) => field.required && isBlank(values[field.key]),
  );

  const handleRun = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tool || missing.length > 0) return;

    setRunning(true);
    setFailure(null);
    setResult(null);

    try {
      setResult(await toolsApi.execute(tool.name, submittable(fields, values)));
    } catch (error) {
      // A transport failure is not a plan. Showing it as one would let "the MCP server
      // is unreachable" read like "the command was refused", which is the opposite
      // conclusion about whether to retry.
      setFailure(
        error instanceof ApiRequestError || error instanceof ApiUnreachableError
          ? error.message
          : t("tools.run.unexpected"),
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <CModal visible={tool !== null} onClose={onClose} alignment="center" size="lg">
      <CForm onSubmit={handleRun} noValidate>
        <CModalHeader>
          <CModalTitle className="d-flex align-items-center gap-2">
            <CIcon icon={cilMediaPlay} />
            <span className="mono">{tool?.name}</span>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <CAlert color="info" className="d-flex align-items-start gap-2 small">
            <CIcon icon={cilShieldAlt} className="mt-1 flex-shrink-0" />
            <div>{t("tools.run.planOnly")}</div>
          </CAlert>

          {fields.length === 0 ? (
            <p className="small text-body-secondary mb-0">{t("tools.run.noInputs")}</p>
          ) : (
            fields.map((field) => (
              <div className="mb-3" key={field.key}>
                <CFormLabel htmlFor={`run-${field.key}`} className="fw-semibold small">
                  <span className="mono">{field.key}</span>
                  {field.required && <span className="text-danger ms-1">*</span>}
                </CFormLabel>
                {renderControl(field, values[field.key], (next) =>
                  setValues((current) => ({ ...current, [field.key]: next })),
                )}
                {field.description && (
                  <CFormText>{field.description}</CFormText>
                )}
              </div>
            ))
          )}

          {missing.length > 0 && (
            <CFormText className="text-danger">
              {t("tools.run.missing", {
                fields: missing.map((field) => field.key).join(", "),
              })}
            </CFormText>
          )}

          {failure && (
            <CAlert color="danger" className="mt-3 mb-0 small d-flex gap-2">
              <CIcon icon={cilXCircle} className="mt-1 flex-shrink-0" />
              <div>{failure}</div>
            </CAlert>
          )}

          {result && <PlanReport result={result} />}
        </CModalBody>

        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose}>
            {t("common.close")}
          </CButton>
          <CButton color="primary" type="submit" disabled={running}>
            {running ? (
              <CSpinner size="sm" className="me-2" />
            ) : (
              <CIcon icon={cilMediaPlay} className="me-2" />
            )}
            {t("tools.run.submit")}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}

/** The resolved plan, action by action. */
function PlanReport({ result }: { result: ExecutionResultPayload }) {
  const t = useT();
  const { plan, dispatch } = result;

  return (
    <div className="mt-4 border-top pt-3">
      <div className="d-flex align-items-center gap-2 mb-3">
        <StatusBadge status={plan.status} />
        {plan.model && <span className="mono small text-body-secondary">{plan.model}</span>}
      </div>

      {plan.problems.length > 0 && (
        <CAlert color={plan.status === "rejected" ? "danger" : "warning"} className="small">
          <ul className="mb-0 ps-3">
            {/* Indexed, not keyed by the text. Two actions of the same definition reach
                the same conclusion often — four REST actions all wanting an id produce
                four identical sentences — and React refuses a list with repeated keys. */}
            {plan.problems.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
        </CAlert>
      )}

      {plan.actions.map((action) => (
        <ActionCard key={action.action_id} action={action} />
      ))}

      <div className="small text-body-secondary d-flex align-items-start gap-2 mt-3">
        <CIcon
          icon={dispatch.status === "refused" ? cilXCircle : cilWarning}
          className="mt-1 flex-shrink-0"
        />
        <div>{dispatch.reason}</div>
      </div>

      {plan.masked_inputs.length > 0 && (
        <div className="small text-body-secondary mt-2">
          {t("tools.run.masked", { fields: plan.masked_inputs.join(", ") })}
        </div>
      )}
    </div>
  );
}

function ActionCard({ action }: { action: PlannedActionPayload }) {
  const t = useT();
  const rejected = action.rejected_reasons.length > 0;

  return (
    <div className="border rounded-3 p-3 mb-2">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <div className="fw-semibold small">{action.name}</div>
        <div className="d-flex gap-1">
          <CBadge color="secondary" shape="rounded-pill">
            {action.kind}
          </CBadge>
          <CBadge
            color={action.authored_by_model ? "info" : "light"}
            textColor={action.authored_by_model ? undefined : "body"}
            shape="rounded-pill"
          >
            {action.mode}
          </CBadge>
        </div>
      </div>

      {action.targets.length > 0 && (
        <div className="small text-body-secondary mb-2">
          {t("tools.run.targets", { targets: action.targets.join(", ") })}
        </div>
      )}

      {/* Withheld deliberately when rejected: the MCP server does not return unvetted
          text, so there is nothing to show and nothing to copy by accident. */}
      {rejected ? (
        <CAlert color="danger" className="small mb-0">
          <ul className="mb-0 ps-3">
            {action.rejected_reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </CAlert>
      ) : (
        <pre className="mono small bg-body-tertiary border rounded-3 p-2 mb-0 text-body overflow-auto">
          {action.resolved}
        </pre>
      )}

      {action.requires_approval && (
        <div className="small text-warning-emphasis mt-2">
          <CIcon icon={cilWarning} size="sm" className="me-1" />
          {t("tools.run.needsApproval")}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: PlanPayload["status"] }) {
  const t = useT();
  // Typed to the plan's own union so the translation key below is checked rather than
  // assembled from an arbitrary string that could quietly resolve to nothing.
  const look = {
    planned: { color: "success", icon: cilCheckCircle },
    incomplete: { color: "warning", icon: cilWarning },
    rejected: { color: "danger", icon: cilXCircle },
  }[status];

  return (
    <CBadge color={look.color} shape="rounded-pill">
      <CIcon icon={look.icon} size="sm" className="me-1" />
      {t(`tools.run.status.${status}`)}
    </CBadge>
  );
}

/* ------------------------------- schema ---------------------------------- */

function readFields(tool: ToolPayload | null): Field[] {
  if (!tool) return [];

  const schema = tool.inputSchema as {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  const required = new Set(schema.required ?? []);

  return Object.entries(schema.properties ?? {}).map(([key, property]) => ({
    ...property,
    key,
    required: required.has(key),
  }));
}

function defaultsOf(fields: Field[]): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter((field) => field.default !== undefined)
      .map((field) => [field.key, field.default]),
  );
}

/**
 * Drops empty optional fields.
 *
 * An omitted argument falls back to the input's declared default; an empty string does
 * not — it overrides the default with nothing. Sending one would silently change what
 * the command resolves to.
 */
function submittable(fields: Field[], values: Record<string, unknown>) {
  return Object.fromEntries(
    fields
      .filter((field) => !isBlank(values[field.key]))
      .map((field) => [field.key, values[field.key]]),
  );
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === "";
}

function renderControl(
  field: Field,
  value: unknown,
  onChange: (next: unknown) => void,
) {
  const id = `run-${field.key}`;

  if (field.type === "boolean") {
    return (
      <CFormCheck
        id={id}
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }

  if (field.enum && field.enum.length > 0) {
    return (
      <CFormSelect
        id={id}
        value={(value as string) ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" />
        {field.enum.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </CFormSelect>
    );
  }

  return (
    <CFormInput
      id={id}
      type={inputType(field)}
      value={(value as string | number | undefined) ?? ""}
      onChange={(event) =>
        onChange(
          field.type === "number" && event.target.value !== ""
            ? Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

function inputType(field: Field) {
  if (field.format === "password") return "password";
  if (field.format === "date") return "date";
  if (field.type === "number") return "number";
  return "text";
}
