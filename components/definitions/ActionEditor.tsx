"use client";

import { useState } from "react";
import CIcon from "@coreui/icons-react";
import {
  cilChevronBottom,
  cilChevronTop,
  cilCloud,
  cilInfo,
  cilPlus,
  cilSpreadsheet,
  cilTerminal,
  cilTrash,
} from "@coreui/icons";
import Link from "next/link";
import CommaListInput, { LineListInput } from "@/components/ListInput";
import { useHostGroups } from "@/lib/host-groups-store";
import { useT, type MessageKey } from "@/lib/i18n";
import { definitionsApi } from "@/lib/api/endpoints";
import { ApiRequestError, ApiUnreachableError } from "@/lib/api/errors";
import { notify } from "@/lib/ui/toast-store";
import {
  CBadge,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CCollapse,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CSpinner,
  CInputGroup,
  CInputGroupText,
  CRow,
} from "@coreui/react";
import {
  actionKindColors,
  actionKindKeys,
  commandModeKeys,
  dbDefaultPorts,
  dbQueryModeKeys,
  resolveTargets,
  runStrategyHintKeys,
  runStrategyKeys,
  sqlOperationLabels,
  targetModeKeys,
  newId,
  type Action,
  type ActionKind,
  type DbEngine,
  type DbAction,
  type CommandMode,
  type DbQueryMode,
  type RunStrategy,
  type SqlOperation,
  type TargetMode,
  type HttpMethod,
  type RestAction,
  type SshAction,
  type SshAuth,
} from "@/lib/definitions";

/** Reads one string out of an action's JSON config, or nothing. */
function asText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** How long to wait for a schema, and how often to ask. A minute at two seconds. */
const INTERVAL_MS = 2000;
const ATTEMPTS = 30;

export const actionIcons: Record<ActionKind, string[]> = {
  rest: cilCloud,
  ssh: cilTerminal,
  db: cilSpreadsheet,
};

type Props = {
  /** The definition's id in the gateway. 0 means it has not been saved yet. */
  definitionId: number;
  action: Action;
  index: number;
  onChange: (action: Action) => void;
  onRemove: () => void;
};

export default function ActionEditor({
  action,
  definitionId,
  index,
  onChange,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(true);
  const hostGroups = useHostGroups();
  const t = useT();

  return (
    <CCard className="mb-3">
      <CCardHeader className="bg-transparent">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span
            className={`avatar-initials bg-${actionKindColors[action.kind]}-subtle text-${actionKindColors[action.kind]}`}
          >
            <CIcon icon={actionIcons[action.kind]} />
          </span>

          <CFormInput
            className="flex-grow-1 fw-semibold border-0 shadow-none px-1"
            style={{ minWidth: 180 }}
            value={action.name}
            aria-label={t("action.nameLabel", { index: index + 1 })}
            onChange={(event) => onChange({ ...action, name: event.target.value })}
          />

          <CBadge color={actionKindColors[action.kind]} shape="rounded-pill">
            {t(actionKindKeys[action.kind])}
          </CBadge>

          {action.kind === "ssh" && resolveTargets(action, hostGroups).length > 1 && (
            <CBadge color="dark" shape="rounded-pill">
              {t("action.ssh.serverCount", { count: resolveTargets(action, hostGroups).length })}
            </CBadge>
          )}

          {action.kind === "ssh" && (
            <CBadge
              color={action.commandMode === "dynamic" ? "success" : "secondary"}
              shape="rounded-pill"
            >
              {t(commandModeKeys[action.commandMode ?? "static"])}
            </CBadge>
          )}

          {action.kind === "db" && (
            <CBadge
              color={action.queryMode === "dynamic" ? "success" : "secondary"}
              shape="rounded-pill"
            >
              {t(dbQueryModeKeys[action.queryMode ?? "static"])}
            </CBadge>
          )}

          <CButton
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            aria-label={open ? t("common.collapse") : t("common.expand")}
          >
            <CIcon icon={open ? cilChevronTop : cilChevronBottom} />
          </CButton>

          <CButton
            color="danger"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={t("action.delete")}
          >
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      </CCardHeader>

      <CCollapse visible={open}>
        <CCardBody>
          <CRow className="g-3">
            <CCol md={12}>
              <CFormLabel htmlFor={`${action.id}-desc`}>{t("common.description")}</CFormLabel>
              <CFormInput
                id={`${action.id}-desc`}
                value={action.description}
                placeholder={t("action.descriptionPlaceholder")}
                onChange={(event) =>
                  onChange({ ...action, description: event.target.value })
                }
              />
            </CCol>

            {action.kind === "rest" && (
              <RestFields action={action} onChange={onChange} />
            )}
            {action.kind === "ssh" && (
              <SshFields action={action} onChange={onChange} />
            )}
            {action.kind === "db" && (
              <DbFields action={action} definitionId={definitionId} onChange={onChange} />
            )}
          </CRow>
        </CCardBody>
      </CCollapse>
    </CCard>
  );
}

/* ------------------------------- REST ------------------------------- */

function RestFields({
  action,
  onChange,
}: {
  action: RestAction;
  onChange: (action: Action) => void;
}) {
  const t = useT();
  const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  return (
    <>
      <CCol md={12}>
        <CFormLabel htmlFor={`${action.id}-url`}>{t("action.rest.endpoint")}</CFormLabel>
        <CInputGroup>
          <CFormSelect
            style={{ maxWidth: 120 }}
            value={action.method}
            aria-label={t("action.rest.method")}
            onChange={(event) => {
              const method = event.target.value as HttpMethod;

              // The body goes with it. Disabling the field left whatever was typed
              // before still in the action, and the gateway refuses a GET carrying one
              // — with the field greyed out there was no way to clear it.
              onChange({
                ...action,
                method,
                body: method === "GET" ? "" : action.body,
              });
            }}
          >
            {methods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </CFormSelect>
          <CFormInput
            id={`${action.id}-url`}
            className="mono"
            value={action.url}
            placeholder="https://api.internal/v1/{{kaynak}}"
            onChange={(event) => onChange({ ...action, url: event.target.value })}
          />
        </CInputGroup>
      </CCol>

      <CCol md={12}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <CFormLabel className="mb-0">{t("action.rest.headers")}</CFormLabel>
          <CButton
            color="secondary"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...action,
                headers: [
                  ...action.headers,
                  { id: newId("hdr"), key: "", value: "" },
                ],
              })
            }
          >
            <CIcon icon={cilPlus} className="me-1" />
            {t("action.rest.addHeader")}
          </CButton>
        </div>

        {action.headers.length === 0 && (
          <p className="small text-body-secondary mb-0">{t("action.rest.noHeaders")}</p>
        )}

        <div className="d-flex flex-column gap-2">
          {action.headers.map((header) => (
            <CInputGroup key={header.id} size="sm">
              <CFormInput
                className="mono"
                value={header.key}
                placeholder="Authorization"
                aria-label={t("action.rest.headerName")}
                onChange={(event) =>
                  onChange({
                    ...action,
                    headers: action.headers.map((item) =>
                      item.id === header.id
                        ? { ...item, key: event.target.value }
                        : item,
                    ),
                  })
                }
              />
              <CFormInput
                className="mono"
                value={header.value}
                placeholder="Bearer {{token}}"
                aria-label={t("action.rest.headerValue")}
                onChange={(event) =>
                  onChange({
                    ...action,
                    headers: action.headers.map((item) =>
                      item.id === header.id
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  })
                }
              />
              <CButton
                color="danger"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...action,
                    headers: action.headers.filter(
                      (item) => item.id !== header.id,
                    ),
                  })
                }
                aria-label={t("action.rest.deleteHeader")}
              >
                <CIcon icon={cilTrash} size="sm" />
              </CButton>
            </CInputGroup>
          ))}
        </div>
      </CCol>

      <CCol md={9}>
        <CFormLabel htmlFor={`${action.id}-body`}>{t("action.rest.body")}</CFormLabel>
        <CFormTextarea
          id={`${action.id}-body`}
          className="mono"
          rows={5}
          value={action.body}
          disabled={action.method === "GET"}
          onChange={(event) => onChange({ ...action, body: event.target.value })}
        />
        {action.method === "GET" && (
          <div className="form-text">{t("action.rest.noBodyOnGet")}</div>
        )}
      </CCol>

      <CCol md={3}>
        <CFormLabel htmlFor={`${action.id}-timeout`}>{t("common.timeout")}</CFormLabel>
        <CInputGroup>
          <CFormInput
            id={`${action.id}-timeout`}
            type="number"
            min={100}
            step={500}
            value={action.timeoutMs}
            onChange={(event) =>
              onChange({ ...action, timeoutMs: Number(event.target.value) })
            }
          />
          <CInputGroupText>ms</CInputGroupText>
        </CInputGroup>
      </CCol>
    </>
  );
}

/* -------------------------------- SSH -------------------------------- */

function SshFields({
  action,
  onChange,
}: {
  action: SshAction;
  onChange: (action: Action) => void;
}) {
  const t = useT();
  const authKeys: Record<SshAuth, MessageKey> = {
    key: "action.ssh.auth.key",
    password: "action.ssh.auth.password",
    agent: "action.ssh.auth.agent",
  };

  const hostGroups = useHostGroups();

  // Older records may not carry these fields; fall back to safe defaults.
  const targetMode: TargetMode = action.targetMode ?? "single";
  const commandMode: CommandMode = action.commandMode ?? "static";
  const strategy: RunStrategy = action.strategy ?? "sequential";
  const targets = resolveTargets(action, hostGroups);
  const multi = targets.length > 1;

  const listValue = (action.hosts ?? []).join("\n");

  return (
    <>
      {/* ----------------------------- Hedef ----------------------------- */}
      <CCol md={12}>
        <div className="fw-semibold small text-uppercase text-body-secondary mb-2">
          {t("action.ssh.target")}
        </div>
        <CButtonGroup role="group" aria-label={t("action.ssh.targetMode")}>
          {(Object.keys(targetModeKeys) as TargetMode[]).map((mode) => (
            <CButton
              key={mode}
              color="primary"
              size="sm"
              variant={targetMode === mode ? undefined : "outline"}
              onClick={() => onChange({ ...action, targetMode: mode })}
            >
              {t(targetModeKeys[mode])}
            </CButton>
          ))}
        </CButtonGroup>
      </CCol>

      {targetMode === "single" && (
        <CCol md={7}>
          <CFormLabel htmlFor={`${action.id}-host`}>{t("common.host")}</CFormLabel>
          <CFormInput
            id={`${action.id}-host`}
            className="mono"
            value={action.host}
            placeholder="app-01.internal veya {{sunucu}}"
            onChange={(event) => onChange({ ...action, host: event.target.value })}
          />
        </CCol>
      )}

      {targetMode === "list" && (
        <CCol md={7}>
          <CFormLabel htmlFor={`${action.id}-hosts`}>{t("action.ssh.hosts")}</CFormLabel>
          <CFormTextarea
            id={`${action.id}-hosts`}
            className="mono"
            rows={4}
            value={listValue}
            placeholder={"web-01.internal\nweb-02.internal\nweb-03.internal"}
            onChange={(event) =>
              onChange({
                ...action,
                hosts: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
          />
          <div className="form-text">{t("action.ssh.hostsHint")}</div>
        </CCol>
      )}

      {targetMode === "group" && (
        <CCol md={7}>
          <CFormLabel htmlFor={`${action.id}-group`}>{t("action.ssh.group")}</CFormLabel>
          <CFormSelect
            id={`${action.id}-group`}
            value={action.hostGroupId ?? ""}
            disabled={hostGroups.length === 0}
            onChange={(event) =>
              onChange({
                ...action,
                hostGroupId: event.target.value ? Number(event.target.value) : null,
              })
            }
          >
            <option value="">{t("action.ssh.selectGroup")}</option>
            {hostGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({t("action.ssh.serverCount", { count: group.hosts.length })}) — {group.description}
              </option>
            ))}
          </CFormSelect>
          <div className="form-text">
            {hostGroups.length === 0 ? (
              <Link href="/host-groups">{t("action.ssh.noGroups")}</Link>
            ) : (
              <Link href="/host-groups">{t("action.ssh.groupsManaged")}</Link>
            )}
          </div>
        </CCol>
      )}

      <CCol md={5}>
        <CFormLabel className="d-block">{t("action.ssh.resolvedTargets")}</CFormLabel>
        {targets.length === 0 ? (
          <div className="small text-body-secondary pt-1">
            {t("action.ssh.noTargets")}
          </div>
        ) : (
          <div className="d-flex flex-wrap gap-1 pt-1">
            {targets.slice(0, 4).map((host) => (
              <CBadge key={host} color="secondary" className="mono">
                {host}
              </CBadge>
            ))}
            {targets.length > 4 && (
              <CBadge color="primary">{t("action.ssh.moreHosts", { count: targets.length - 4 })}</CBadge>
            )}
          </div>
        )}
      </CCol>

      {/* --------------------------- Host key'ler --------------------------- */}
      <CCol md={12}>
        <CFormLabel className="d-block">{t("action.ssh.hostKeys")}</CFormLabel>
        <div className="form-text mb-2">{t("action.ssh.hostKeysHint")}</div>

        {targets.length === 0 ? (
          <div className="small text-body-secondary">{t("action.ssh.hostKeysNoTargets")}</div>
        ) : (
          targets.map((host) => {
            const templated = host.includes("{{");
            const value = action.hostKeys?.[host] ?? "";

            return (
              <div className="mb-2" key={host}>
                <CInputGroup size="sm">
                  <CInputGroupText className="mono" style={{ minWidth: "12rem" }}>
                    {host}
                  </CInputGroupText>
                  <CFormInput
                    className="mono"
                    value={value}
                    disabled={templated}
                    placeholder={
                      templated
                        ? t("action.ssh.hostKeyTemplated")
                        : "ssh-ed25519 AAAAC3Nza..."
                    }
                    onChange={(event) =>
                      onChange({
                        ...action,
                        hostKeys: { ...(action.hostKeys ?? {}), [host]: event.target.value },
                      })
                    }
                  />
                </CInputGroup>
                {!templated && !value && (
                  <div className="form-text text-warning-emphasis">
                    {t("action.ssh.hostKeyMissing", { host })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CCol>

      {multi && (
        <>
          <CCol md={4}>
            <CFormLabel htmlFor={`${action.id}-strategy`}>
              {t("action.ssh.strategy")}
            </CFormLabel>
            <CFormSelect
              id={`${action.id}-strategy`}
              value={strategy}
              onChange={(event) =>
                onChange({
                  ...action,
                  strategy: event.target.value as RunStrategy,
                })
              }
            >
              {(Object.keys(runStrategyKeys) as RunStrategy[]).map((item) => (
                <option key={item} value={item}>
                  {t(runStrategyKeys[item])}
                </option>
              ))}
            </CFormSelect>
            <div className="form-text">{t(runStrategyHintKeys[strategy])}</div>
          </CCol>

          {strategy === "parallel" && (
            <CCol md={3}>
              <CFormLabel htmlFor={`${action.id}-concurrency`}>
                {t("action.ssh.concurrency")}
              </CFormLabel>
              <CFormInput
                id={`${action.id}-concurrency`}
                type="number"
                min={1}
                max={targets.length}
                value={action.concurrency ?? 4}
                onChange={(event) =>
                  onChange({ ...action, concurrency: Number(event.target.value) })
                }
              />
            </CCol>
          )}

          {strategy === "rolling" && (
            <CCol md={3}>
              <CFormLabel htmlFor={`${action.id}-batch`}>{t("action.ssh.batchSize")}</CFormLabel>
              <CFormInput
                id={`${action.id}-batch`}
                type="number"
                min={1}
                max={targets.length}
                value={action.batchSize ?? 2}
                onChange={(event) =>
                  onChange({ ...action, batchSize: Number(event.target.value) })
                }
              />
              <div className="form-text">
                {t("action.ssh.rounds", {
                  count: Math.ceil(
                    targets.length / Math.max(action.batchSize ?? 2, 1),
                  ),
                })}
              </div>
            </CCol>
          )}

          <CCol md={5} className="d-flex align-items-end pb-3">
            <CFormCheck
              id={`${action.id}-stoponerror`}
              label={t("action.ssh.stopOnError")}
              checked={action.stopOnError ?? true}
              onChange={(event) =>
                onChange({ ...action, stopOnError: event.target.checked })
              }
            />
          </CCol>
        </>
      )}

      {/* ----------------------------- Kimlik ----------------------------- */}
      <CCol md={12}>
        <hr className="my-1" />
        <div className="fw-semibold small text-uppercase text-body-secondary mb-2">
          {t("action.ssh.connection")}
        </div>
      </CCol>

      <CCol md={2}>
        <CFormLabel htmlFor={`${action.id}-port`}>{t("common.port")}</CFormLabel>
        <CFormInput
          id={`${action.id}-port`}
          type="number"
          value={action.port}
          onChange={(event) =>
            onChange({ ...action, port: Number(event.target.value) })
          }
        />
      </CCol>

      <CCol md={3}>
        <CFormLabel htmlFor={`${action.id}-user`}>{t("common.user")}</CFormLabel>
        <CFormInput
          id={`${action.id}-user`}
          className="mono"
          value={action.user}
          onChange={(event) => onChange({ ...action, user: event.target.value })}
        />
      </CCol>

      <CCol md={4}>
        <CFormLabel htmlFor={`${action.id}-auth`}>{t("action.ssh.auth")}</CFormLabel>
        <CFormSelect
          id={`${action.id}-auth`}
          value={action.auth}
          onChange={(event) =>
            onChange({ ...action, auth: event.target.value as SshAuth })
          }
        >
          {(Object.keys(authKeys) as SshAuth[]).map((value) => (
            <option key={value} value={value}>
              {t(authKeys[value])}
            </option>
          ))}
        </CFormSelect>
      </CCol>

      <CCol md={3}>
        <CFormLabel htmlFor={`${action.id}-cwd`}>{t("action.ssh.workingDir")}</CFormLabel>
        <CFormInput
          id={`${action.id}-cwd`}
          className="mono"
          value={action.workingDir}
          onChange={(event) =>
            onChange({ ...action, workingDir: event.target.value })
          }
        />
      </CCol>

      {action.auth === "key" && (
        <>
          <CCol md={12}>
            <SecretField
              id={`${action.id}-key`}
              label={t("action.ssh.privateKey")}
              stored={action.privateKeySecretId != null}
              value={action.privateKey}
              multiline
              placeholder={
                "-----BEGIN OPENSSH PRIVATE KEY-----\n…\n-----END OPENSSH PRIVATE KEY-----"
              }
              hint={t("action.ssh.privateKeyHint")}
              onChange={(next) => onChange({ ...action, privateKey: next })}
            />
          </CCol>

          <CCol md={6}>
            <SecretField
              id={`${action.id}-passphrase`}
              label={t("action.ssh.passphrase")}
              stored={action.passphraseSecretId != null}
              value={action.passphrase}
              placeholder={t("action.ssh.passphrasePlaceholder")}
              onChange={(next) => onChange({ ...action, passphrase: next })}
            />
          </CCol>
        </>
      )}

      {action.auth === "password" && (
        <CCol md={6}>
          <SecretField
            id={`${action.id}-sshpass`}
            label={t("action.ssh.auth.password")}
            stored={action.passwordSecretId != null}
            value={action.password}
            hint={t("action.ssh.passwordHint")}
            onChange={(next) => onChange({ ...action, password: next })}
          />
        </CCol>
      )}

      {action.auth === "agent" && (
        <CCol md={12}>
          <div className="alert alert-info py-2 small mb-0">
            <CIcon icon={cilInfo} className="me-2" />
            {t("action.ssh.agentInfo")}
          </div>
        </CCol>
      )}

      {/* ----------------------------- Komut ----------------------------- */}
      <CCol md={12}>
        <hr className="my-1" />
        <div className="fw-semibold small text-uppercase text-body-secondary mb-2">
          {t("common.command")}
        </div>
        <CButtonGroup role="group" aria-label={t("action.ssh.commandMode")}>
          {(Object.keys(commandModeKeys) as CommandMode[]).map((mode) => (
            <CButton
              key={mode}
              color="primary"
              size="sm"
              variant={commandMode === mode ? undefined : "outline"}
              onClick={() => onChange({ ...action, commandMode: mode })}
            >
              {t(commandModeKeys[mode])}
            </CButton>
          ))}
        </CButtonGroup>
        <div className="form-text">
          {commandMode === "static"
            ? t("action.ssh.staticHint")
            : t("action.ssh.dynamicHint")}
        </div>
      </CCol>

      {commandMode === "static" ? (
        <CCol md={12}>
          <CFormLabel htmlFor={`${action.id}-command`}>{t("common.command")}</CFormLabel>
          <CFormTextarea
            id={`${action.id}-command`}
            className="mono"
            rows={4}
            value={action.command}
            placeholder="systemctl restart apache2 && systemctl is-active apache2"
            onChange={(event) =>
              onChange({ ...action, command: event.target.value })
            }
          />
          <div className="form-text">
            {t("action.ssh.commandHint")}
          </div>
        </CCol>
      ) : (
        <>
          <CCol md={6}>
            <CFormLabel htmlFor={`${action.id}-allowed`}>
              {t("action.ssh.allowedCommands")}
            </CFormLabel>
            <LineListInput
              id={`${action.id}-allowed`}
              className="mono"
              items={action.allowedCommands ?? []}
              placeholder={"systemctl restart apache2\nsystemctl status\njournalctl -u apache2"}
              onChange={(allowedCommands) => onChange({ ...action, allowedCommands })}
            />
            <div className="form-text">
              {t("action.ssh.allowedHint")}
            </div>
          </CCol>

          <CCol md={6}>
            <CFormLabel htmlFor={`${action.id}-blocked`}>
              {t("action.ssh.blockedPatterns")}
            </CFormLabel>
            <LineListInput
              id={`${action.id}-blocked`}
              className="mono"
              items={action.blockedPatterns ?? []}
              placeholder={"rm -rf\nmkfs\nshutdown"}
              onChange={(blockedPatterns) => onChange({ ...action, blockedPatterns })}
            />
            <div className="form-text">
              {t("action.ssh.blockedHint")}
            </div>
          </CCol>

          <CCol md={12}>
            <CFormLabel htmlFor={`${action.id}-guidance`}>
              {t("action.ssh.guidance")}
            </CFormLabel>
            <CFormTextarea
              id={`${action.id}-guidance`}
              rows={3}
              value={action.commandGuidance ?? ""}
              placeholder={t("action.ssh.guidancePlaceholder")}
              onChange={(event) =>
                onChange({ ...action, commandGuidance: event.target.value })
              }
            />
          </CCol>

          <CCol md={6}>
            <CFormCheck
              id={`${action.id}-approval`}
              label={t("action.ssh.requireApproval")}
              checked={action.requireApproval ?? true}
              onChange={(event) =>
                onChange({ ...action, requireApproval: event.target.checked })
              }
            />
          </CCol>
        </>
      )}

      <CCol md={12}>
        <CFormCheck
          id={`${action.id}-sudo`}
          label={t("action.ssh.sudo")}
          checked={action.sudo}
          onChange={(event) => onChange({ ...action, sudo: event.target.checked })}
        />
      </CCol>

      <CCol md={6}>
        <CFormCheck
          id={`${action.id}-follow`}
          label={t("action.ssh.follow")}
          checked={action.follow}
          onChange={(event) => onChange({ ...action, follow: event.target.checked })}
        />
        <div className="form-text">{t("action.ssh.followHelp")}</div>
      </CCol>

      {/* Only with the box ticked: a window on a command nobody is following means
          nothing, and an input that does nothing is worse than one that is not there. */}
      {action.follow && (
        <CCol md={6}>
          <CFormLabel htmlFor={`${action.id}-follow-idle`}>
            {t("action.ssh.followIdle")}
          </CFormLabel>
          <CFormInput
            id={`${action.id}-follow-idle`}
            type="number"
            min={1}
            max={300}
            value={action.followIdleSeconds}
            onChange={(event) =>
              onChange({ ...action, followIdleSeconds: Number(event.target.value) })
            }
          />
          <div className="form-text">{t("action.ssh.followIdleHelp")}</div>
        </CCol>
      )}
    </>
  );
}

/* ------------------------------ Database ------------------------------ */

function DbFields({
  action,
  definitionId,
  onChange,
}: {
  action: DbAction;
  definitionId: number;
  onChange: (action: Action) => void;
}) {
  const t = useT();
  /*
   * MongoDB is offered and cannot run.
   *
   * Not an oversight in the executor: everything around a database action here is SQL —
   * the permitted statement types, the guardrails that read a statement's leading
   * keyword, the schema read out of information_schema, and the instruction the model is
   * given ("write a single SQL statement"). Mongo would be a different kind of action
   * rather than another value in this list, so it is shown as what it is instead of
   * being quietly removed or quietly broken.
   */
  const engines: { value: DbEngine; label: string; runnable: boolean }[] = [
    { value: "postgres", label: "PostgreSQL", runnable: true },
    { value: "mysql", label: "MySQL / MariaDB", runnable: true },
    { value: "mssql", label: "SQL Server", runnable: true },
    { value: "sqlite", label: "SQLite", runnable: true },
    { value: "mongodb", label: "MongoDB", runnable: false },
  ];

  // Older records may not carry these fields; fall back to the static default.
  const queryMode: DbQueryMode = action.queryMode ?? "static";
  const operations: SqlOperation[] = action.allowedOperations ?? ["select"];

  return (
    <>
      <CCol md={3}>
        <CFormLabel htmlFor={`${action.id}-engine`}>{t("action.db.engine")}</CFormLabel>
        <CFormSelect
          id={`${action.id}-engine`}
          value={action.engine}
          onChange={(event) => {
            const engine = event.target.value as DbEngine;
            onChange({ ...action, engine, port: dbDefaultPorts[engine] });
          }}
        >
          {engines.map((engine) => (
            <option key={engine.value} value={engine.value} disabled={!engine.runnable}>
              {engine.label}
              {engine.runnable ? "" : ` — ${t("action.db.engineUnsupported")}`}
            </option>
          ))}
        </CFormSelect>
        {action.engine === "mongodb" && (
          <div className="form-text text-warning-emphasis">
            {t("action.db.engineUnsupportedHelp")}
          </div>
        )}
      </CCol>

      <CCol md={4}>
        <CFormLabel htmlFor={`${action.id}-dbhost`}>{t("common.host")}</CFormLabel>
        <CFormInput
          id={`${action.id}-dbhost`}
          className="mono"
          value={action.host}
          placeholder="db-replica.internal"
          disabled={action.engine === "sqlite"}
          onChange={(event) => onChange({ ...action, host: event.target.value })}
        />
      </CCol>

      <CCol md={2}>
        <CFormLabel htmlFor={`${action.id}-dbport`}>{t("common.port")}</CFormLabel>
        <CFormInput
          id={`${action.id}-dbport`}
          type="number"
          value={action.port}
          disabled={action.engine === "sqlite"}
          onChange={(event) =>
            onChange({ ...action, port: Number(event.target.value) })
          }
        />
      </CCol>

      <CCol md={3}>
        <CFormLabel htmlFor={`${action.id}-dbuser`}>{t("common.user")}</CFormLabel>
        <CFormInput
          id={`${action.id}-dbuser`}
          className="mono"
          value={action.user}
          disabled={action.engine === "sqlite"}
          onChange={(event) => onChange({ ...action, user: event.target.value })}
        />
      </CCol>

      <CCol md={6}>
        <CFormLabel htmlFor={`${action.id}-database`}>
          {action.engine === "sqlite"
            ? t("action.db.filePath")
            : t("action.db.database")}
        </CFormLabel>
        <CFormInput
          id={`${action.id}-database`}
          className="mono"
          value={action.database}
          placeholder={
            action.engine === "sqlite" ? "/var/data/app.db" : "mcp_metrics"
          }
          onChange={(event) =>
            onChange({ ...action, database: event.target.value })
          }
        />
      </CCol>

      {/* SQLite is a file, so there is nobody to authenticate to. */}
      {action.engine !== "sqlite" && (
        <CCol md={6}>
          <SecretField
            id={`${action.id}-dbpass`}
            label={t("action.db.password")}
            stored={action.passwordSecretId != null}
            value={action.password}
            hint={t("action.db.passwordHint")}
            onChange={(next) => onChange({ ...action, password: next })}
          />
        </CCol>
      )}

      <CCol md={12}>
        <CFormLabel className="d-block">{t("action.db.queryMode")}</CFormLabel>
        <CButtonGroup role="group" aria-label={t("action.db.queryMode")}>
          {(Object.keys(dbQueryModeKeys) as DbQueryMode[]).map((mode) => (
            <CButton
              key={mode}
              color="primary"
              size="sm"
              variant={queryMode === mode ? undefined : "outline"}
              onClick={() => onChange({ ...action, queryMode: mode })}
            >
              {t(dbQueryModeKeys[mode])}
            </CButton>
          ))}
        </CButtonGroup>
        <div className="form-text">
          {queryMode === "static"
            ? t("action.db.staticHint")
            : t("action.db.dynamicHint")}
        </div>
      </CCol>

      {queryMode === "static" ? (
        <CCol md={12}>
          <CFormLabel htmlFor={`${action.id}-query`}>{t("common.query")}</CFormLabel>
          <CFormTextarea
            id={`${action.id}-query`}
            className="mono"
            rows={6}
            value={action.query}
            placeholder="SELECT * FROM tool_calls WHERE created_at >= '{{baslangic}}' LIMIT {{limit}};"
            onChange={(event) => onChange({ ...action, query: event.target.value })}
          />
        </CCol>
      ) : (
        <>
          <CCol md={12}>
            <SchemaTables
              action={action}
              definitionId={definitionId}
              onChange={onChange}
            />
          </CCol>

          <CCol md={12}>
            <CFormLabel htmlFor={`${action.id}-schema`}>{t("action.db.schemaHint")}</CFormLabel>
            <CFormTextarea
              id={`${action.id}-schema`}
              className="mono"
              rows={4}
              value={action.schemaHint ?? ""}
              placeholder={
                "tool_calls(id, tool, server, actor, duration_ms, created_at)\nservers(id, name, transport, status)"
              }
              onChange={(event) =>
                onChange({ ...action, schemaHint: event.target.value })
              }
            />
            <div className="form-text">
              {t("action.db.schemaHintHelp")}
            </div>
          </CCol>

          <CCol md={12}>
            <CFormLabel htmlFor={`${action.id}-guidance`}>
              {t("action.db.guidance")}
            </CFormLabel>
            <CFormTextarea
              id={`${action.id}-guidance`}
              rows={3}
              value={action.guidance ?? ""}
              placeholder={t("action.db.guidancePlaceholder")}
              onChange={(event) =>
                onChange({ ...action, guidance: event.target.value })
              }
            />
          </CCol>

          <CCol md={7}>
            <CFormLabel className="d-block">{t("action.db.allowedOperations")}</CFormLabel>
            <div className="d-flex flex-wrap gap-3 pt-1">
              {(Object.keys(sqlOperationLabels) as SqlOperation[]).map((op) => {
                const locked = action.readOnly && op !== "select";

                return (
                  <CFormCheck
                    key={op}
                    inline
                    id={`${action.id}-op-${op}`}
                    className="mono"
                    label={sqlOperationLabels[op]}
                    disabled={locked}
                    checked={!locked && operations.includes(op)}
                    onChange={(event) =>
                      onChange({
                        ...action,
                        allowedOperations: event.target.checked
                          ? [...operations, op]
                          : operations.filter((item) => item !== op),
                      })
                    }
                  />
                );
              })}
            </div>
            {action.readOnly && (
              <div className="form-text">
                {t("action.db.readOnlyLock")}
              </div>
            )}
          </CCol>

          <CCol md={5}>
            <CFormLabel htmlFor={`${action.id}-maxrows`}>
              {t("action.db.maxRows")}
            </CFormLabel>
            <CFormInput
              id={`${action.id}-maxrows`}
              type="number"
              min={1}
              value={action.maxRows ?? 100}
              onChange={(event) =>
                onChange({ ...action, maxRows: Number(event.target.value) })
              }
            />
          </CCol>

          <CCol md={12}>
            <CFormCheck
              id={`${action.id}-approval`}
              label={t("action.db.requireApproval")}
              checked={action.requireApproval ?? true}
              onChange={(event) =>
                onChange({ ...action, requireApproval: event.target.checked })
              }
            />
          </CCol>
        </>
      )}

      <CCol md={12}>
        <CFormCheck
          id={`${action.id}-readonly`}
          label={t("action.db.readOnly")}
          checked={action.readOnly}
          onChange={(event) => {
            const readOnly = event.target.checked;
            onChange({
              ...action,
              readOnly,
              // Unlocking read-only drops the write permissions with it.
              allowedOperations: readOnly
                ? operations.filter((op) => op === "select")
                : operations,
            });
          }}
        />
      </CCol>
    </>
  );
}

/**
 * A credential the gateway stores and never gives back.
 *
 * Write only, and three-valued: `undefined` means untouched and the stored value is kept,
 * `""` means remove it, anything else replaces it. That distinction is the whole point —
 * without it, opening a definition and saving it again would wipe every credential on it,
 * because the form has nothing to put back.
 *
 * Until this existed the panel wrote a plaintext key into the action's JSON config, which
 * the gateway silently dropped: the field showed a success toast and stored nothing.
 */
function SecretField({
  id,
  label,
  stored,
  value,
  placeholder,
  hint,
  multiline = false,
  onChange,
}: {
  id: string;
  label: string;
  stored: boolean;
  value: string | undefined;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  onChange: (next: string | undefined) => void;
}) {
  const t = useT();
  const touched = value !== undefined;

  return (
    <>
      <CFormLabel htmlFor={id}>{label}</CFormLabel>

      {multiline ? (
        <CFormTextarea
          id={id}
          className="mono"
          rows={4}
          value={value ?? ""}
          placeholder={stored && !touched ? t("action.ssh.secretStored") : placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <CFormInput
          id={id}
          type="password"
          className="mono"
          autoComplete="off"
          value={value ?? ""}
          placeholder={stored && !touched ? t("action.ssh.secretStored") : placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      <div className="form-text d-flex flex-wrap align-items-center gap-2">
        <span>
          {value === ""
            ? t("action.ssh.secretWillBeRemoved")
            : stored
              ? t("action.ssh.secretReplaceHint")
              : (hint ?? t("action.ssh.secretHint"))}
        </span>

        {stored && !touched && (
          <CButton
            size="sm"
            color="secondary"
            variant="outline"
            type="button"
            // Sets the empty string rather than clearing the field: an untouched field and
            // an emptied one mean opposite things.
            onClick={() => onChange("")}
          >
            {t("models.form.apiKeyRemove")}
          </CButton>
        )}
        {touched && (
          <CButton
            size="sm"
            color="secondary"
            variant="outline"
            type="button"
            onClick={() => onChange(undefined)}
          >
            {t("common.cancel")}
          </CButton>
        )}
      </div>
    </>
  );
}

/**
 * The tables a model is told about, and a way to read their real structure.
 *
 * An allow list rather than a filter. A real schema has hundreds of tables and will not fit
 * in a prompt — and a model given all of them picks the wrong one more often than it picks
 * none. Two or three named tables are both cheaper and more accurate.
 *
 * Reading is asynchronous: the request travels through the executor, which is the only
 * thing that can reach the database, and the answer is written onto the action. So the
 * button reports that it asked, and the page is reloaded to see the result.
 */
function SchemaTables({
  action,
  definitionId,
  onChange,
}: {
  action: DbAction;
  definitionId: number;
  onChange: (action: Action) => void;
}) {
  const t = useT();
  const [reading, setReading] = useState(false);
  const [asked, setAsked] = useState(false);

  const tables = action.schemaTables ?? [];
  const actionId = action.actionId;

  // Either half being missing means the same thing: there is nothing on the server to
  // introspect yet. A new action inside a saved definition has no id of its own until the
  // definition is saved again.
  const unsaved = definitionId === 0 || actionId === null;

  /**
   * Waits for the schema the request asked for, then shows it.
   *
   * The read travels by queue — the gateway dispatches it, an executor runs it and the
   * answer comes back by another queue — so there is nothing to return from the request
   * itself. This used to end there, telling the operator to reload the page; they added a
   * table, saw the old schema, and pressed the button three more times.
   */
  const waitForSchema = async (previous: string | null) => {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      await new Promise((resume) => setTimeout(resume, INTERVAL_MS));

      const fresh = await definitionsApi.get(definitionId).catch(() => null);
      const read = fresh?.actions.find((item) => item.id === actionId);

      // The config is an untyped JSON document on the wire, so the two fields this cares
      // about are narrowed here rather than trusted.
      const at = asText(read?.config?.generatedSchemaAt);

      // Compared against what was on screen before, not merely for presence: a re-read
      // that returns the same tables has to count as an answer too.
      if (at && at !== previous) {
        // What was read is the saved list, not the one on screen. Adding a table and
        // pressing the button without saving reads the old set and looks like the read
        // silently ignored it.
        const savedTables = read?.config?.schemaTables;

        if (Array.isArray(savedTables) && savedTables.join(" ") !== tables.join(" ")) {
          notify.success("action.db.schemaTablesUnsaved");
        }

        onChange({
          ...action,
          generatedSchema: asText(read?.config?.generatedSchema),
          generatedSchemaAt: at,
        });
        return true;
      }
    }
    return false;
  };

  const read = async () => {
    // Guarded rather than asserted: the button is disabled without an id, and a guard says
    // so at the one place it matters instead of trusting that it always will be.
    if (actionId === null) return;

    setReading(true);
    setAsked(false);
    try {
      await definitionsApi.introspect(definitionId, actionId);
      // Reported only once it has actually arrived: the request being accepted and the
      // database having answered are different things, and saying "done" for the first
      // is what sent the operator to look at a schema that had not changed.
      const arrived = await waitForSchema(action.generatedSchemaAt ?? null);

      if (arrived) {
        notify.success("action.db.schemaRead");
      } else {
        setAsked(true);
      }
    } catch (error) {
      notify.failure(
        error instanceof ApiRequestError || error instanceof ApiUnreachableError
          ? error.message
          : t("tools.run.unexpected"),
      );
    } finally {
      setReading(false);
    }
  };

  return (
    <>
      <CFormLabel htmlFor={`${action.id}-tables`}>{t("action.db.schemaTables")}</CFormLabel>
      <CommaListInput
        id={`${action.id}-tables`}
        className="mono"
        items={tables}
        placeholder="orders, customers"
        onChange={(schemaTables) => onChange({ ...action, schemaTables })}
      />

      <div className="form-text d-flex flex-wrap align-items-center gap-2">
        <span>{t("action.db.schemaTablesHelp")}</span>

        <CButton
          size="sm"
          color="secondary"
          variant="outline"
          type="button"
          // Disabled before the definition exists: introspection is dispatched by id, and
          // there is nothing to dispatch against until it has been saved once.
          disabled={reading || unsaved || tables.length === 0}
          title={unsaved ? t("action.db.schemaSaveFirst") : undefined}
          onClick={read}
        >
          {reading && <CSpinner size="sm" className="me-1" />}
          {t("action.db.readSchema")}
        </CButton>

        {asked && (
          <span className="text-warning-emphasis">{t("action.db.schemaAsked")}</span>
        )}

        {action.generatedSchemaAt && (
          <span className="text-success-emphasis">
            {t("action.db.schemaReadAt", {
              at: new Date(action.generatedSchemaAt).toLocaleString(),
            })}
          </span>
        )}
      </div>

      {action.generatedSchema && (
        <pre className="mono small bg-body-tertiary border rounded-3 p-2 mt-2 mb-0 text-body overflow-auto">
          {action.generatedSchema}
        </pre>
      )}
    </>
  );
}
