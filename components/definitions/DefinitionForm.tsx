"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CIcon from "@coreui/icons-react";
import {
  cilCloud,
  cilCopy,
  cilPlus,
  cilSave,
  cilSpreadsheet,
  cilTerminal,
  cilWarning,
} from "@coreui/icons";
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import ActionEditor from "./ActionEditor";
import InputsEditor from "./InputsEditor";
import {
  actionKindKeys,
  runStrategyKeys,
  createAction,
  newActionKeys,
  resolveTargets,
  resolveTemplate,
  slugifyToolName,
  sqlOperationLabels,
  templateFieldsOf,
  unknownPlaceholders,
  type Action,
  type ActionKind,
  type Definition,
} from "@/lib/definitions";
import { useDefinitionActions } from "@/lib/definitions-store";
import { useHostGroups } from "@/lib/host-groups-store";
import { useModels } from "@/lib/models-store";
import { useT, type Translate } from "@/lib/i18n";
import type { HostGroupLike } from "@/lib/definitions";

const kindIcons: Record<ActionKind, string[]> = {
  rest: cilCloud,
  ssh: cilTerminal,
  db: cilSpreadsheet,
};

/** A secret is never shown in the clear in a preview, under any circumstances. */
function maskSecret(value: string) {
  return value.trim() ? "••••••••" : "—";
}

function previewOf(
  action: Action,
  inputs: Definition["inputs"],
  groups: HostGroupLike[],
  t: Translate,
): string {
  if (action.kind === "rest") {
    const headers = action.headers
      .filter((header) => header.key)
      .map((header) => `${header.key}: ${resolveTemplate(header.value, inputs)}`)
      .join("\n");
    const body =
      action.method !== "GET" && action.body.trim()
        ? `\n\n${resolveTemplate(action.body, inputs)}`
        : "";

    return `${action.method} ${resolveTemplate(action.url, inputs)}${
      headers ? `\n${headers}` : ""
    }${body}`;
  }

  if (action.kind === "ssh") {
    const targets = resolveTargets(action, groups);
    const lines: string[] = [];

    // What it will run against.
    if (targets.length === 0) {
      lines.push(`# ${t("preview.target")}: ${t("preview.target.none")}`);
    } else if (targets.length === 1) {
      lines.push(`# ${t("preview.target")}: ${resolveTemplate(targets[0], inputs)}`);
    } else {
      const shown = targets.slice(0, 3).join(", ");
      const rest =
        targets.length > 3
          ? t("preview.target.more", { count: targets.length - 3 })
          : "";
      lines.push(
        `# ${t("preview.target")}: ${t("preview.target.many", {
          count: targets.length,
          shown,
        })}${rest}`,
      );

      const strategy = action.strategy ?? "sequential";
      const detail =
        strategy === "parallel"
          ? t("preview.strategy.parallel", { count: action.concurrency ?? 4 })
          : strategy === "rolling"
            ? t("preview.strategy.rolling", {
                size: action.batchSize ?? 2,
                rounds: Math.ceil(
                  targets.length / Math.max(action.batchSize ?? 2, 1),
                ),
              })
            : t("preview.strategy.sequential");
      lines.push(
        `# ${t("preview.strategy")}: ${t(runStrategyKeys[strategy])} (${detail})${
          (action.stopOnError ?? true)
            ? t("preview.stopOnError")
            : t("preview.continueOnError")
        }`,
      );
    }

    // Credentials.
    const host =
      targets.length === 1
        ? resolveTemplate(targets[0], inputs)
        : targets.length > 1
          ? t("preview.eachHost")
          : t("preview.host");
    const target = `${action.user}@${host} -p ${action.port}`;

    if (action.auth === "key") {
      lines.push(
        `# ${t("preview.credentials")}: ${t("preview.auth.key")} ${maskSecret(
          action.privateKey ?? "",
        )}${(action.passphrase ?? "").trim() ? t("preview.auth.passphrase") : ""}`,
        `ssh -i ${t("preview.privateKey")} ${target}`,
      );
    } else if (action.auth === "password") {
      lines.push(
        `# ${t("preview.credentials")}: ${t("preview.auth.password")} ${maskSecret(
          action.password ?? "",
        )}`,
        `ssh ${target}`,
      );
    } else {
      lines.push(
        `# ${t("preview.credentials")}: ${t("preview.auth.agent")}`,
        `ssh -A ${target}`,
      );
    }

    lines.push(`cd ${resolveTemplate(action.workingDir, inputs)}`);

    // The command.
    if ((action.commandMode ?? "static") === "static") {
      lines.push(
        `${action.sudo ? "sudo " : ""}${
          resolveTemplate(action.command, inputs) || t("preview.command")
        }`,
      );
    } else {
      const allowed = action.allowedCommands ?? [];
      const blocked = action.blockedPatterns ?? [];

      lines.push(
        "",
        `# ${t("preview.commandMode.dynamic")}`,
        `# ${t("preview.allowedPrefixes")}: ${allowed.join(" · ") || "—"}`,
        `# ${t("preview.blockedPatterns")}: ${blocked.join(" · ") || "—"}`,
      );

      const flags = [
        (action.requireApproval ?? true) ? t("preview.approvalAsked") : null,
        action.sudo ? t("preview.withSudo") : null,
      ].filter(Boolean);
      if (flags.length > 0) lines.push(`# ${flags.join(" · ")}`);

      if ((action.commandGuidance ?? "").trim()) {
        lines.push(
          `# ${t("preview.rule")}: ${resolveTemplate(action.commandGuidance, inputs)}`,
        );
      }

      lines.push("", t("preview.commandElsewhere"));
    }

    return lines.join("\n");
  }

  const dsn = `${action.engine}://${action.user}@${
    action.host || t("preview.host")
  }:${action.port}/${action.database || t("preview.database")}`;

  if ((action.queryMode ?? "static") === "static") {
    return `${dsn}\n\n${resolveTemplate(action.query, inputs) || t("preview.query")}`;
  }

  const operations = action.allowedOperations ?? ["select"];
  const lines = [
    dsn,
    "",
    `# ${t("preview.queryMode.dynamic")}`,
    `# ${t("preview.allowedStatements")}: ${
      operations.map((op) => sqlOperationLabels[op]).join(", ") || "—"
    }`,
    `# ${t("preview.rowCeiling")}: ${action.maxRows ?? 100}${
      (action.requireApproval ?? true) ? t("preview.approvalBeforeRun") : ""
    }`,
  ];

  if ((action.schemaHint ?? "").trim()) {
    lines.push(
      `# ${t("preview.schema")}:`,
      ...action.schemaHint
        .split("\n")
        .map((line) => `#   ${line}`),
    );
  }

  if ((action.guidance ?? "").trim()) {
    lines.push(`# ${t("preview.rule")}: ${resolveTemplate(action.guidance, inputs)}`);
  }

  lines.push("", t("preview.queryElsewhere"));

  return lines.join("\n");
}

export default function DefinitionForm({
  initial,
  mode,
}: {
  initial: Definition;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const { save } = useDefinitionActions();
  const hostGroups = useHostGroups();
  const models = useModels();
  const t = useT();
  const [definition, setDefinition] = useState<Definition>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const patch = (changes: Partial<Definition>) =>
    setDefinition((current) => ({ ...current, ...changes }));

  const allTemplates = useMemo(
    () => [
      definition.systemPrompt,
      ...definition.actions.flatMap(templateFieldsOf),
    ],
    [definition],
  );

  const orphans = useMemo(
    () => unknownPlaceholders(allTemplates, definition.inputs),
    [allTemplates, definition.inputs],
  );

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!definition.name.trim()) list.push(t("definitionForm.error.name"));
    if (!definition.modelId) list.push(t("definitionForm.error.model"));
    if (!definition.toolName.trim()) list.push(t("definitionForm.error.toolName"));
    if (!definition.toolDescription.trim())
      list.push(t("definitionForm.error.toolDescription"));
    if (!definition.systemPrompt.trim()) list.push(t("definitionForm.error.prompt"));
    if (definition.actions.length === 0)
      list.push(t("definitionForm.error.noAction"));

    for (const action of definition.actions) {
      if (action.kind === "ssh") {
        if (resolveTargets(action, hostGroups).length === 0) {
          list.push(t("definitionForm.error.noTarget", { name: action.name }));
        }

        if (
          (action.commandMode ?? "static") === "static" &&
          !action.command.trim()
        ) {
          list.push(t("definitionForm.error.emptyCommand", { name: action.name }));
        }

        if (
          (action.commandMode ?? "static") === "dynamic" &&
          (action.allowedCommands ?? []).length === 0
        ) {
          list.push(
            t("definitionForm.error.noAllowedCommand", { name: action.name }),
          );
        }
      }

      if (action.kind !== "db") continue;

      if ((action.queryMode ?? "static") === "static" && !action.query.trim()) {
        list.push(t("definitionForm.error.emptyQuery", { name: action.name }));
      }

      if (
        (action.queryMode ?? "static") === "dynamic" &&
        (action.allowedOperations ?? []).length === 0
      ) {
        list.push(
          t("definitionForm.error.noOperation", { name: action.name }),
        );
      }
    }

    const keys = definition.inputs.map((input) => input.key);
    if (keys.some((key) => !key))
      list.push(t("definitionForm.error.emptyKey"));
    if (new Set(keys).size !== keys.length)
      list.push(t("definitionForm.error.duplicateKeys"));

    return list;
  }, [definition, hostGroups, t]);

  // Translated here rather than in the factory: the name is saved with the action, so it is
  // resolved once, in the language the person creating it is working in.
  const addAction = (kind: ActionKind) =>
    patch({ actions: [...definition.actions, createAction(kind, t(newActionKeys[kind]))] });

  const updateAction = (updated: Action) =>
    patch({
      actions: definition.actions.map((action) =>
        action.id === updated.id ? updated : action,
      ),
    });

  const copyPlaceholder = (key: string) => {
    void navigator.clipboard?.writeText(`{{${key}}}`);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (errors.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Awaited, and the navigation is conditional. It used to fire immediately: a rejected
    // save left the user on the list, looking at a definition that had not been saved,
    // with nothing on screen to say so.
    const saved = await save(definition);
    if (!saved) return;

    // A new definition opens rather than closing. Reading a schema is dispatched by id, so
    // the button for it is disabled until the definition exists — and sending the user to
    // the list at exactly that moment hid the one step a dynamic query cannot work
    // without. Editing an existing one still returns to the list.
    router.push(mode === "create" ? `/definitions/${saved.id}` : "/definitions");
  };

  return (
    <CForm onSubmit={handleSubmit} noValidate>
      <PageHeader
        title={mode === "create" ? t("definitionForm.newTitle") : t("definitionForm.editTitle")}
        description={t("definitionForm.subtitle")}
        actions={
          <>
            <CButton
              color="secondary"
              variant="outline"
              onClick={() => router.push("/definitions")}
            >
              {t("common.cancel")}
            </CButton>
            <CButton color="primary" type="submit">
              <CIcon icon={cilSave} className="me-2" />
              {t("common.save")}
            </CButton>
          </>
        }
      />

      {submitted && errors.length > 0 && (
        <CAlert color="danger">
          <div className="fw-semibold mb-1">{t("definitionForm.errorsTitle")}</div>
          <ul className="mb-0 small">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </CAlert>
      )}

      {/* ----------------------- Temel bilgiler ----------------------- */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent fw-semibold">
          {t("definitionForm.basics")}
        </CCardHeader>
        <CCardBody>
          <CRow className="g-3">
            <CCol md={5}>
              <CFormLabel htmlFor="def-name">{t("definitionForm.name")}</CFormLabel>
              <CFormInput
                id="def-name"
                value={definition.name}
                placeholder={t("definitionForm.namePlaceholder")}
                invalid={submitted && !definition.name.trim()}
                onChange={(event) => {
                  const name = event.target.value;
                  // Left alone by hand, the tool name follows the definition's name.
                  const auto =
                    definition.toolName === slugifyToolName(definition.name);
                  patch(
                    auto
                      ? { name, toolName: slugifyToolName(name) }
                      : { name },
                  );
                }}
              />
            </CCol>

            <CCol md={5}>
              <CFormLabel htmlFor="def-model">{t("definitionForm.model")}</CFormLabel>
              <CFormSelect
                id="def-model"
                value={definition.modelId ?? ""}
                invalid={submitted && !definition.modelId}
                onChange={(event) =>
                  patch({
                    modelId: event.target.value ? Number(event.target.value) : null,
                  })
                }
              >
                <option value="">{t("definitionForm.modelPlaceholder")}</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id} disabled={!model.enabled}>
                    {model.name} ({model.modelId})
                    {model.enabled ? "" : ` — ${t("definitionForm.modelPassive")}`}
                  </option>
                ))}
              </CFormSelect>
              <div className="form-text">
                <Link href="/models">{t("definitionForm.modelHint")}</Link>
              </div>
            </CCol>

            <CCol md={2} className="d-flex align-items-start pt-4">
              <CFormCheck
                id="def-enabled"
                label={t("common.enabled")}
                checked={definition.enabled}
                onChange={(event) => patch({ enabled: event.target.checked })}
              />
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* -------------------------- The MCP tool ------------------------- */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent">
          <div className="fw-semibold">{t("definitionForm.toolCard")}</div>
          <div className="small text-body-secondary">
            {t("definitionForm.toolCardHint")}
          </div>
        </CCardHeader>
        <CCardBody>
          <CRow className="g-3">
            <CCol md={5}>
              <CFormLabel htmlFor="def-toolname">{t("definitionForm.toolName")}</CFormLabel>
              <CFormInput
                id="def-toolname"
                className="mono"
                value={definition.toolName}
                invalid={submitted && !definition.toolName.trim()}
                placeholder="uretim_dagitimi"
                onChange={(event) =>
                  patch({ toolName: slugifyToolName(event.target.value) })
                }
              />
              <div className="form-text">
                {t("definitionForm.toolNameHint")}
              </div>
            </CCol>

            <CCol md={7}>
              <CFormLabel htmlFor="def-tooldesc">{t("definitionForm.toolDescription")}</CFormLabel>
              <CFormTextarea
                id="def-tooldesc"
                rows={3}
                value={definition.toolDescription}
                invalid={submitted && !definition.toolDescription.trim()}
                placeholder={t("definitionForm.toolDescriptionPlaceholder")}
                onChange={(event) =>
                  patch({ toolDescription: event.target.value })
                }
              />
              <div className="form-text">
                {t("definitionForm.toolDescriptionHint")}
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {/* ------------------------ System prompt ------------------------ */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent d-flex align-items-center justify-content-between">
          <span className="fw-semibold">{t("definitionForm.systemPrompt")}</span>
          <span className="small text-body-secondary">
            {t("definitionForm.charCount", {
              count: definition.systemPrompt.length,
            })}
          </span>
        </CCardHeader>
        <CCardBody>
          <CFormTextarea
            id="def-prompt"
            rows={7}
            value={definition.systemPrompt}
            invalid={submitted && !definition.systemPrompt.trim()}
            placeholder={t("definitionForm.promptPlaceholder")}
            onChange={(event) => patch({ systemPrompt: event.target.value })}
          />

          {definition.inputs.length > 0 && (
            <div className="mt-3">
              <div className="small text-body-secondary mb-2">
                {t("definitionForm.placeholders")}
              </div>
              <div className="d-flex flex-wrap gap-2">
                {definition.inputs
                  .filter((input) => input.key)
                  .map((input) => (
                    <CBadge
                      key={input.id}
                      color={copied === input.key ? "success" : "secondary"}
                      shape="rounded-pill"
                      className="mono"
                      role="button"
                      onClick={() => copyPlaceholder(input.key)}
                    >
                      <CIcon icon={cilCopy} size="sm" className="me-1" />
                      {copied === input.key
                        ? t("definitionForm.copied")
                        : `{{${input.key}}}`}
                    </CBadge>
                  ))}
              </div>
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* ------------------------- The actions --------------------------- */}
      <CCard className="mb-4">
        <CCardHeader className="bg-transparent d-flex align-items-center justify-content-between">
          <div>
            <div className="fw-semibold">{t("definitionForm.actionsTitle")}</div>
            <div className="small text-body-secondary">
              {t("definitionForm.actionsHint")}
            </div>
          </div>
          <CDropdown alignment="end">
            <CDropdownToggle color="primary" size="sm">
              <CIcon icon={cilPlus} className="me-2" />
              {t("definitionForm.addAction")}
            </CDropdownToggle>
            <CDropdownMenu>
              {(Object.keys(actionKindKeys) as ActionKind[]).map((kind) => (
                <CDropdownItem
                  key={kind}
                  role="button"
                  onClick={() => addAction(kind)}
                >
                  <CIcon icon={kindIcons[kind]} className="me-2" />
                  {t(actionKindKeys[kind])}
                </CDropdownItem>
              ))}
            </CDropdownMenu>
          </CDropdown>
        </CCardHeader>

        <CCardBody>
          {definition.actions.length === 0 ? (
            <p className="text-body-secondary small text-center py-4 mb-0">
              {t("definitionForm.noActions")}
            </p>
          ) : (
            definition.actions.map((action, index) => (
              <ActionEditor
                key={action.id}
                action={action}
                definitionId={definition.id}
                index={index}
                onChange={updateAction}
                onRemove={() =>
                  patch({
                    actions: definition.actions.filter(
                      (item) => item.id !== action.id,
                    ),
                  })
                }
              />
            ))
          )}
        </CCardBody>
      </CCard>

      {/* ------------------------ Dinamik girdiler ------------------------ */}
      <InputsEditor
        inputs={definition.inputs}
        onChange={(inputs) => patch({ inputs })}
      />

      {orphans.length > 0 && (
        <CAlert color="warning" className="d-flex align-items-start gap-2">
          <CIcon icon={cilWarning} className="mt-1 flex-shrink-0" />
          <div>
            <div className="fw-semibold">{t("definitionForm.orphanTitle")}</div>
            <div className="small">
              {t("definitionForm.orphanBody", {
                keys: orphans.map((key) => `{{${key}}}`).join(", "),
              })}
            </div>
          </div>
        </CAlert>
      )}

      {/* --------------------------- Preview ----------------------------- */}
      {definition.actions.length > 0 && (
        <CCard className="mb-4">
          <CCardHeader className="bg-transparent fw-semibold">
            {t("common.preview")}
            <span className="fw-normal small text-body-secondary ms-2">
              {t("definitionForm.previewHint")}
            </span>
          </CCardHeader>
          <CCardBody className="d-flex flex-column gap-3">
            {definition.actions.map((action) => (
              <div key={action.id}>
                <div className="small fw-semibold mb-1">
                  {action.name}
                  <CBadge color="secondary" className="ms-2">
                    {t(actionKindKeys[action.kind])}
                  </CBadge>
                </div>
                <pre className="mono small bg-body-tertiary border rounded-3 p-3 mb-0 text-body">
                  {previewOf(action, definition.inputs, hostGroups, t)}
                </pre>
              </div>
            ))}
          </CCardBody>
        </CCard>
      )}

      <div className="d-flex justify-content-end gap-2 mb-4">
        <CButton
          color="secondary"
          variant="outline"
          onClick={() => router.push("/definitions")}
        >
          {t("common.cancel")}
        </CButton>
        <CButton color="primary" type="submit">
          <CIcon icon={cilSave} className="me-2" />
          {mode === "create"
            ? t("definitionForm.create")
            : t("common.saveChanges")}
        </CButton>
      </div>
    </CForm>
  );
}
