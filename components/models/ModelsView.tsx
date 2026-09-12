"use client";

import { useState } from "react";
import CIcon from "@coreui/icons-react";
import {
  cilInfo,
  cilOptions,
  cilPlus,
  cilTrash,
  cilWarning,
} from "@coreui/icons";
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CDropdown,
  CDropdownDivider,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import {
  createModel,
  effortKeys,
  modelStatusMeta,
  providerColors,
  providerDefaultEndpoints,
  providerKeys,
  useModelActions,
  useModels,
  usesEffort,
  type AiModel,
  type Effort,
  type ModelProvider,
} from "@/lib/models-store";
import { useT } from "@/lib/i18n";

export default function ModelsView() {
  const models = useModels();
  const { save, remove, toggle } = useModelActions();
  const t = useT();

  const [editing, setEditing] = useState<AiModel | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AiModel | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const valid =
    editing !== null &&
    editing.name.trim().length > 0 &&
    editing.modelId.trim().length > 0 &&
    editing.endpoint.trim().length > 0;

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!editing || !valid) return;
    save(editing);
    setEditing(null);
    setSubmitted(false);
  };

  const openNew = () => {
    setSubmitted(false);
    setEditing(createModel());
  };

  return (
    <>
      <PageHeader
        title={t("models.title")}
        description={t("models.subtitle")}
        actions={
          <CButton color="primary" onClick={openNew}>
            <CIcon icon={cilPlus} className="me-2" />
            {t("models.new")}
          </CButton>
        }
      />

      <CAlert color="info" className="d-flex align-items-start gap-2">
        <CIcon icon={cilInfo} className="mt-1 flex-shrink-0" />
        <div className="small">
          {t("models.info")}
        </div>
      </CAlert>

      <CCard>
        <CCardBody className="pt-2">
          <CTable align="middle" hover responsive className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>{t("common.model")}</CTableHeaderCell>
                <CTableHeaderCell>{t("models.column.provider")}</CTableHeaderCell>
                <CTableHeaderCell>{t("models.column.endpoint")}</CTableHeaderCell>
                <CTableHeaderCell>{t("models.column.apiKey")}</CTableHeaderCell>
                <CTableHeaderCell>{t("common.status")}</CTableHeaderCell>
                <CTableHeaderCell className="text-end">
                  {t("common.latency")}
                </CTableHeaderCell>
                <CTableHeaderCell className="text-end">
                  {t("dashboard.definitions")}
                </CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {models.map((model) => (
                <CTableRow key={model.id}>
                  <CTableDataCell>
                    <div className="fw-semibold">{model.name}</div>
                    <div className="small text-body-secondary mono">
                      {model.modelId}
                    </div>
                  </CTableDataCell>

                  <CTableDataCell>
                    <CBadge
                      color={providerColors[model.provider]}
                      shape="rounded-pill"
                    >
                      {t(providerKeys[model.provider])}
                    </CBadge>
                  </CTableDataCell>

                  <CTableDataCell
                    className="small mono text-truncate"
                    style={{ maxWidth: 200 }}
                  >
                    {model.endpoint}
                  </CTableDataCell>

                  <CTableDataCell className="small mono">
                    {model.apiKeySecretName ?? <span className="text-body-secondary">—</span>}
                  </CTableDataCell>

                  <CTableDataCell>
                    <CBadge
                      color={
                        model.enabled
                          ? modelStatusMeta[model.status].color
                          : "secondary"
                      }
                      shape="rounded-pill"
                    >
                      {model.enabled
                        ? t(modelStatusMeta[model.status].key)
                        : t("common.disabled")}
                    </CBadge>
                  </CTableDataCell>

                  <CTableDataCell className="text-end mono small">
                    {model.latencyMs ? `${model.latencyMs} ms` : "—"}
                  </CTableDataCell>

                  <CTableDataCell className="text-end mono">
                    {model.definitionCount}
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
                        aria-label={t("models.actionsLabel")}
                      >
                        <CIcon icon={cilOptions} />
                      </CDropdownToggle>
                      <CDropdownMenu>
                        <CDropdownItem
                          role="button"
                          onClick={() => {
                            setSubmitted(false);
                            setEditing({ ...model });
                          }}
                        >
                          {t("common.edit")}
                        </CDropdownItem>
                        <CDropdownItem
                          role="button"
                          onClick={() => toggle(model.id)}
                        >
                          {model.enabled
                            ? t("common.deactivate")
                            : t("common.activate")}
                        </CDropdownItem>
                        <CDropdownDivider />
                        <CDropdownItem
                          role="button"
                          className="text-danger"
                          onClick={() => setPendingDelete(model)}
                        >
                          <CIcon icon={cilTrash} className="me-2" />
                          {t("common.delete")}
                        </CDropdownItem>
                      </CDropdownMenu>
                    </CDropdown>
                  </CTableDataCell>
                </CTableRow>
              ))}

              {models.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={8} className="text-center py-5">
                    <div className="text-body-secondary mb-3">
                      {t("models.empty")}
                    </div>
                    <CButton color="primary" onClick={openNew}>
                      <CIcon icon={cilPlus} className="me-2" />
                      {t("models.addFirst")}
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* ---------------------------- Editing ---------------------------- */}
      <CModal
        visible={editing !== null}
        onClose={() => setEditing(null)}
        alignment="center"
        size="lg"
      >
        <CForm onSubmit={handleSave} noValidate>
          <CModalHeader>
            <CModalTitle>
              {editing && models.some((model) => model.id === editing.id)
                ? t("models.form.editTitle")
                : t("models.form.newTitle")}
            </CModalTitle>
          </CModalHeader>

          <CModalBody>
            {editing && (
              <CRow className="g-3">
                <CCol md={7}>
                  <CFormLabel htmlFor="model-name">{t("models.form.displayName")}</CFormLabel>
                  <CFormInput
                    id="model-name"
                    value={editing.name}
                    invalid={submitted && !editing.name.trim()}
                    placeholder={t("models.namePlaceholder")}
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                  />
                </CCol>

                <CCol md={5}>
                  <CFormLabel htmlFor="model-provider">{t("models.form.provider")}</CFormLabel>
                  <CFormSelect
                    id="model-provider"
                    value={editing.provider}
                    onChange={(event) => {
                      const provider = event.target.value as ModelProvider;
                      setEditing({
                        ...editing,
                        provider,
                        endpoint:
                          providerDefaultEndpoints[provider] || editing.endpoint,
                      });
                    }}
                  >
                    {(Object.keys(providerKeys) as ModelProvider[]).map(
                      (provider) => (
                        <option key={provider} value={provider}>
                          {t(providerKeys[provider])}
                        </option>
                      ),
                    )}
                  </CFormSelect>
                </CCol>

                <CCol md={5}>
                  <CFormLabel htmlFor="model-id">{t("models.form.modelId")}</CFormLabel>
                  <CFormInput
                    id="model-id"
                    className="mono"
                    value={editing.modelId}
                    invalid={submitted && !editing.modelId.trim()}
                    placeholder="claude-opus-5"
                    onChange={(event) =>
                      setEditing({ ...editing, modelId: event.target.value })
                    }
                  />
                  {editing.provider === "anthropic" && (
                    <div className="form-text">
                      {t("models.form.modelIdHint")}{" "}
                      <code className="mono">claude-opus-5</code>,{" "}
                      <code className="mono">claude-sonnet-5</code>,{" "}
                      <code className="mono">claude-haiku-4-5</code>.
                    </div>
                  )}
                </CCol>

                <CCol md={7}>
                  <CFormLabel htmlFor="model-endpoint">{t("models.form.endpoint")}</CFormLabel>
                  <CFormInput
                    id="model-endpoint"
                    className="mono"
                    value={editing.endpoint}
                    invalid={submitted && !editing.endpoint.trim()}
                    placeholder="https://api.anthropic.com"
                    onChange={(event) =>
                      setEditing({ ...editing, endpoint: event.target.value })
                    }
                  />
                </CCol>

                <CCol md={12}>
                  <CFormLabel htmlFor="model-key">
                    {t("models.form.apiKey")}
                  </CFormLabel>
                  <CInputGroup>
                    <CFormInput
                      id="model-key"
                      className="mono"
                      type="password"
                      autoComplete="off"
                      value={editing.apiKey ?? ""}
                      // Write only. The gateway never returns a stored key, so the field
                      // starts empty even for a model that has one — the placeholder is
                      // what distinguishes "there is a key, leave it alone" from "there
                      // is none".
                      placeholder={
                        editing.hasApiKey
                          ? t("models.form.apiKeyStored")
                          : t("models.form.apiKeyUnbound")
                      }
                      onChange={(event) =>
                        setEditing({ ...editing, apiKey: event.target.value })
                      }
                    />
                    {editing.hasApiKey && editing.apiKey === undefined && (
                      <CButton
                        color="secondary"
                        variant="outline"
                        type="button"
                        // Sets the empty string rather than clearing the field, because an
                        // untouched field and an emptied one mean opposite things: one
                        // keeps the key, the other removes it.
                        onClick={() => setEditing({ ...editing, apiKey: "" })}
                      >
                        {t("models.form.apiKeyRemove")}
                      </CButton>
                    )}
                  </CInputGroup>
                  <div className="form-text">
                    {editing.apiKey === ""
                      ? t("models.form.apiKeyWillBeRemoved")
                      : editing.hasApiKey
                        ? t("models.form.apiKeyReplaceHint")
                        : t("models.form.apiKeyHint")}
                  </div>
                </CCol>

                <CCol md={12}>
                  <hr className="my-1" />
                  <div className="fw-semibold small text-uppercase text-body-secondary mb-2">
                    {t("models.form.requestParams")}
                  </div>
                </CCol>

                <CCol md={4}>
                  <CFormLabel htmlFor="model-maxtokens">max_tokens</CFormLabel>
                  <CFormInput
                    id="model-maxtokens"
                    type="number"
                    min={1}
                    value={editing.maxTokens}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        maxTokens: Number(event.target.value),
                      })
                    }
                  />
                </CCol>

                {usesEffort(editing.provider) ? (
                  <>
                    <CCol md={8}>
                      <CFormLabel htmlFor="model-effort">effort</CFormLabel>
                      <CFormSelect
                        id="model-effort"
                        value={editing.effort}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            effort: event.target.value as Effort,
                          })
                        }
                      >
                        {(Object.keys(effortKeys) as Effort[]).map((level) => (
                          <option key={level} value={level}>
                            {t(effortKeys[level])}
                          </option>
                        ))}
                      </CFormSelect>
                    </CCol>

                    <CCol md={12}>
                      <CFormCheck
                        id="model-thinking"
                        label={t("models.form.thinking")}
                        checked={editing.thinking === "adaptive"}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            thinking: event.target.checked
                              ? "adaptive"
                              : "disabled",
                          })
                        }
                      />
                      <div className="form-text">
                        {t("models.form.thinkingHint")}
                      </div>
                    </CCol>
                  </>
                ) : (
                  <CCol md={4}>
                    <CFormLabel htmlFor="model-temp">temperature</CFormLabel>
                    <CFormInput
                      id="model-temp"
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={editing.temperature}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          temperature: Number(event.target.value),
                        })
                      }
                    />
                  </CCol>
                )}

                <CCol md={4}>
                  <CFormLabel htmlFor="model-timeout">{t("common.timeout")}</CFormLabel>
                  <CInputGroup>
                    <CFormInput
                      id="model-timeout"
                      type="number"
                      min={1000}
                      step={1000}
                      value={editing.timeoutMs}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          timeoutMs: Number(event.target.value),
                        })
                      }
                    />
                    <CInputGroupText>ms</CInputGroupText>
                  </CInputGroup>
                </CCol>

                <CCol md={12}>
                  <CFormLabel htmlFor="model-notes">{t("common.note")}</CFormLabel>
                  <CFormTextarea
                    id="model-notes"
                    rows={2}
                    value={editing.notes}
                    onChange={(event) =>
                      setEditing({ ...editing, notes: event.target.value })
                    }
                  />
                </CCol>

                <CCol md={12}>
                  <CFormCheck
                    id="model-enabled"
                    label={t("common.enabled")}
                    checked={editing.enabled}
                    onChange={(event) =>
                      setEditing({ ...editing, enabled: event.target.checked })
                    }
                  />
                </CCol>
              </CRow>
            )}
          </CModalBody>

          <CModalFooter>
            <CButton
              color="secondary"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              {t("common.cancel")}
            </CButton>
            <CButton color="primary" type="submit">
              {t("common.save")}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>

      {/* ----------------------------- Silme ----------------------------- */}
      <CModal
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle>{t("models.delete.title")}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="mb-2">
            {t("models.delete.body", { name: pendingDelete?.name ?? "" })}
          </p>

          {pendingDelete && pendingDelete.definitionCount > 0 && (
            <CAlert color="warning" className="d-flex align-items-start gap-2 mb-0">
              <CIcon icon={cilWarning} className="mt-1 flex-shrink-0" />
              <div className="small">
                {t("models.delete.inUse")}{" "}
                {t("dashboard.definitions")}: {pendingDelete.definitionCount} —{" "}
                {t("models.delete.orphanWarning")}
              </div>
            </CAlert>
          )}
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
