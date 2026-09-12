"use client";

import CIcon from "@coreui/icons-react";
import { cilPlus, cilTrash } from "@coreui/icons";
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CRow,
} from "@coreui/react";
import {
  createInput,
  inputSourceHintKeys,
  inputSourceKeys,
  inputTypeKeys,
  type DynamicInput,
  type InputSource,
  type InputType,
} from "@/lib/definitions";
import CommaListInput from "@/components/ListInput";
import { useT } from "@/lib/i18n";

type Props = {
  inputs: DynamicInput[];
  onChange: (inputs: DynamicInput[]) => void;
};

/** The key is substituted into a template, so it is limited to letters, digits and underscores. */
const KEY_PATTERN = /^[a-z_][a-z0-9_]*$/;

function slugifyKey(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^(\d)/, "_$1");
}

export default function InputsEditor({ inputs, onChange }: Props) {
  const t = useT();

  const update = (id: string, patch: Partial<DynamicInput>) => {
    onChange(
      inputs.map((input) => (input.id === id ? { ...input, ...patch } : input)),
    );
  };

  const duplicateKeys = new Set(
    inputs
      .map((input) => input.key)
      .filter((key, index, all) => key && all.indexOf(key) !== index),
  );

  return (
    <CCard className="mb-4">
      <CCardHeader className="bg-transparent d-flex align-items-center justify-content-between">
        <div>
          <div className="fw-semibold">{t("inputs.title")}</div>
          <div className="small text-body-secondary">
            {t("inputs.subtitle")}{" "}
            <code className="mono">{"{{key}}"}</code>
          </div>
        </div>
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          onClick={() => onChange([...inputs, createInput()])}
        >
          <CIcon icon={cilPlus} className="me-2" />
          {t("inputs.add")}
        </CButton>
      </CCardHeader>

      <CCardBody>
        {inputs.length === 0 ? (
          <p className="text-body-secondary small mb-0 text-center py-4">
            {t("inputs.empty")}
          </p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {inputs.map((input, index) => {
              const keyInvalid = Boolean(
                input.key && !KEY_PATTERN.test(input.key),
              );
              const keyDuplicate = duplicateKeys.has(input.key);

              return (
                <div key={input.id} className="border rounded-3 p-3">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="badge text-bg-secondary">
                      {t("inputs.index", { index: index + 1 })}
                    </span>
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onChange(inputs.filter((item) => item.id !== input.id))
                      }
                      aria-label={t("inputs.delete")}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </div>

                  <CRow className="g-3">
                    <CCol md={4}>
                      <CFormLabel htmlFor={`${input.id}-key`}>
                        {t("inputs.key")}
                      </CFormLabel>
                      <CInputGroup className="has-validation">
                        <CInputGroupText className="mono">{"{{"}</CInputGroupText>
                        <CFormInput
                          id={`${input.id}-key`}
                          className="mono"
                          value={input.key}
                          invalid={keyInvalid || keyDuplicate}
                          placeholder="ornek_anahtar"
                          onChange={(event) =>
                            update(input.id, {
                              key: slugifyKey(event.target.value),
                            })
                          }
                        />
                        <CInputGroupText className="mono">{"}}"}</CInputGroupText>
                        <div className="invalid-feedback">
                          {keyDuplicate
                            ? t("inputs.keyDuplicate")
                            : t("inputs.keyFormat")}
                        </div>
                      </CInputGroup>
                    </CCol>

                    <CCol md={5}>
                      <CFormLabel htmlFor={`${input.id}-label`}>
                        {t("inputs.label")}
                      </CFormLabel>
                      <CFormInput
                        id={`${input.id}-label`}
                        value={input.label}
                        placeholder={t("inputs.labelPlaceholder")}
                        onChange={(event) =>
                          update(input.id, { label: event.target.value })
                        }
                      />
                    </CCol>

                    <CCol md={3}>
                      <CFormLabel htmlFor={`${input.id}-type`}>{t("inputs.type")}</CFormLabel>
                      <CFormSelect
                        id={`${input.id}-type`}
                        value={input.type}
                        onChange={(event) =>
                          update(input.id, {
                            type: event.target.value as InputType,
                            defaultValue: "",
                          })
                        }
                      >
                        {(Object.keys(inputTypeKeys) as InputType[]).map(
                          (value) => (
                            <option key={value} value={value}>
                              {t(inputTypeKeys[value])}
                            </option>
                          ),
                        )}
                      </CFormSelect>
                    </CCol>

                    <CCol md={3}>
                      <CFormLabel htmlFor={`${input.id}-source`}>
                        {t("inputs.source")}
                      </CFormLabel>
                      <CFormSelect
                        id={`${input.id}-source`}
                        value={input.source ?? "prompt"}
                        onChange={(event) =>
                          update(input.id, {
                            source: event.target.value as InputSource,
                          })
                        }
                      >
                        {(Object.keys(inputSourceKeys) as InputSource[]).map((value) => (
                          <option key={value} value={value}>
                            {t(inputSourceKeys[value])}
                          </option>
                        ))}
                      </CFormSelect>
                      <div className="form-text">
                        {t(inputSourceHintKeys[input.source ?? "prompt"])}
                      </div>
                    </CCol>

                    {input.type === "select" && (
                      <CCol md={12}>
                        <CFormLabel htmlFor={`${input.id}-options`}>
                          {t("inputs.options")}
                        </CFormLabel>
                        <CommaListInput
                          id={`${input.id}-options`}
                          items={input.options}
                          placeholder="production, staging, canary"
                          onChange={(options) => update(input.id, { options })}
                        />
                        <div className="form-text">{t("inputs.optionsHint")}</div>
                      </CCol>
                    )}

                    <CCol md={5}>
                      <CFormLabel htmlFor={`${input.id}-default`}>
                        {t("inputs.defaultValue")}
                      </CFormLabel>
                      {input.type === "select" ? (
                        <CFormSelect
                          id={`${input.id}-default`}
                          value={input.defaultValue}
                          onChange={(event) =>
                            update(input.id, { defaultValue: event.target.value })
                          }
                        >
                          <option value="">{t("inputs.noSelection")}</option>
                          {input.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </CFormSelect>
                      ) : input.type === "boolean" ? (
                        <CFormSelect
                          id={`${input.id}-default`}
                          value={input.defaultValue}
                          onChange={(event) =>
                            update(input.id, { defaultValue: event.target.value })
                          }
                        >
                          <option value="">{t("inputs.noSelection")}</option>
                          <option value="true">{t("inputs.yes")}</option>
                          <option value="false">{t("inputs.no")}</option>
                        </CFormSelect>
                      ) : input.type === "textarea" || input.type === "block" ? (
                        <CFormTextarea
                          id={`${input.id}-default`}
                          rows={2}
                          value={input.defaultValue}
                          onChange={(event) =>
                            update(input.id, { defaultValue: event.target.value })
                          }
                        />
                      ) : (
                        <CFormInput
                          id={`${input.id}-default`}
                          type={
                            input.type === "number"
                              ? "number"
                              : input.type === "date"
                                ? "date"
                                : input.type === "password"
                                  ? "password"
                                  : "text"
                          }
                          value={input.defaultValue}
                          onChange={(event) =>
                            update(input.id, { defaultValue: event.target.value })
                          }
                        />
                      )}
                      {input.type === "password" && (
                        <div className="form-text">
                          {t("inputs.passwordHint")}
                        </div>
                      )}
                    </CCol>

                    <CCol md={5}>
                      <CFormLabel htmlFor={`${input.id}-placeholder`}>
                        {t("inputs.placeholder")}
                      </CFormLabel>
                      <CFormInput
                        id={`${input.id}-placeholder`}
                        value={input.placeholder}
                        onChange={(event) =>
                          update(input.id, { placeholder: event.target.value })
                        }
                      />
                    </CCol>

                    <CCol md={2} className="d-flex align-items-end pb-2">
                      <CFormCheck
                        id={`${input.id}-required`}
                        label={t("common.required")}
                        checked={input.required}
                        onChange={(event) =>
                          update(input.id, { required: event.target.checked })
                        }
                      />
                    </CCol>
                  </CRow>
                </div>
              );
            })}
          </div>
        )}
      </CCardBody>
    </CCard>
  );
}
