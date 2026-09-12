"use client";

import { useState } from "react";
import CIcon from "@coreui/icons-react";
import {
  cilPencil,
  cilPlus,
  cilSitemap,
  cilTrash,
  cilWarning,
} from "@coreui/icons";
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardFooter,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import {
  createHostGroup,
  useHostGroupActions,
  useHostGroups,
  type HostGroup,
} from "@/lib/host-groups-store";
import { useT } from "@/lib/i18n";

function GroupCard({
  group,
  usedByCount,
  onEdit,
  onDelete,
}: {
  group: HostGroup;
  usedByCount: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();

  return (
    <CCard className="h-100">
      <CCardBody>
        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
          <div>
            <div className="fw-semibold mono">{group.name || t("hostGroups.unnamed")}</div>
            <div className="small text-body-secondary">{group.description}</div>
          </div>
          <CBadge color="primary" shape="rounded-pill">
            {t("action.ssh.serverCount", { count: group.hosts.length })}
          </CBadge>
        </div>

        <div className="d-flex flex-wrap gap-1 mt-3">
          {group.hosts.slice(0, 6).map((host) => (
            <CBadge key={host} color="secondary" className="mono fw-normal">
              {host}
            </CBadge>
          ))}
          {group.hosts.length > 6 && (
            <CBadge color="dark">+{group.hosts.length - 6}</CBadge>
          )}
          {group.hosts.length === 0 && (
            <span className="small text-body-secondary">
              {t("hostGroups.noHosts")}
            </span>
          )}
        </div>
      </CCardBody>

      <CCardFooter className="bg-transparent d-flex align-items-center justify-content-between">
        <span className="small text-body-secondary">
          {usedByCount > 0
            ? t("hostGroups.usedBy", { count: usedByCount })
            : t("hostGroups.unused")}
        </span>
        <div className="d-flex gap-1">
          <CButton color="secondary" variant="ghost" size="sm" onClick={onEdit}>
            <CIcon icon={cilPencil} className="me-1" />
            {t("common.edit")}
          </CButton>
          <CButton color="danger" variant="ghost" size="sm" onClick={onDelete}>
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      </CCardFooter>
    </CCard>
  );
}

export default function HostGroupsView() {
  const groups = useHostGroups();
  const { save, remove } = useHostGroupActions();
  const t = useT();

  const [editing, setEditing] = useState<HostGroup | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HostGroup | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const nameTaken =
    editing !== null &&
    groups.some(
      (group) => group.id !== editing.id && group.name === editing.name.trim(),
    );

  const valid = editing !== null && editing.name.trim().length > 0 && !nameTaken;

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!editing || !valid) return;
    save({ ...editing, name: editing.name.trim() });
    setEditing(null);
    setSubmitted(false);
  };

  return (
    <>
      <PageHeader
        title={t("hostGroups.title")}
        description={t("hostGroups.subtitle")}
        actions={
          <CButton
            color="primary"
            onClick={() => {
              setSubmitted(false);
              setEditing(createHostGroup());
            }}
          >
            <CIcon icon={cilPlus} className="me-2" />
            {t("hostGroups.new")}
          </CButton>
        }
      />

      <CAlert color="info" className="d-flex align-items-start gap-2">
        <CIcon icon={cilSitemap} className="mt-1 flex-shrink-0" />
        <div className="small">
          {t("hostGroups.info")}
        </div>
      </CAlert>

      <CRow className="g-3">
        {groups.map((group) => (
          <CCol key={group.id} md={6} xl={4}>
            <GroupCard
              group={group}
              usedByCount={group.usedByCount}
              onEdit={() => {
                setSubmitted(false);
                setEditing({ ...group });
              }}
              onDelete={() => setPendingDelete(group)}
            />
          </CCol>
        ))}

        {groups.length === 0 && (
          <CCol>
            <CCard>
              <CCardBody className="text-center py-5">
                <CIcon
                  icon={cilSitemap}
                  size="xl"
                  className="text-body-secondary mb-2 d-block mx-auto"
                />
                <div className="text-body-secondary mb-3">
                  {t("hostGroups.empty")}
                </div>
                <CButton
                  color="primary"
                  onClick={() => setEditing(createHostGroup())}
                >
                  <CIcon icon={cilPlus} className="me-2" />
                  {t("hostGroups.createFirst")}
                </CButton>
              </CCardBody>
            </CCard>
          </CCol>
        )}
      </CRow>

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
              {editing && groups.some((group) => group.id === editing.id)
                ? t("hostGroups.form.editTitle")
                : t("hostGroups.form.newTitle")}
            </CModalTitle>
          </CModalHeader>

          <CModalBody>
            {editing && (
              <CRow className="g-3">
                <CCol md={5}>
                  <CFormLabel htmlFor="group-name">{t("hostGroups.form.name")}</CFormLabel>
                  <CFormInput
                    id="group-name"
                    className="mono"
                    value={editing.name}
                    invalid={submitted && (!editing.name.trim() || nameTaken)}
                    placeholder="web-sunuculari"
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                  />
                  <div className="invalid-feedback d-block">
                    {submitted && nameTaken
                      ? t("hostGroups.form.nameTaken")
                      : submitted && !editing.name.trim()
                        ? t("hostGroups.form.nameRequired")
                        : ""}
                  </div>
                </CCol>

                <CCol md={7}>
                  <CFormLabel htmlFor="group-desc">{t("common.description")}</CFormLabel>
                  <CFormInput
                    id="group-desc"
                    value={editing.description}
                    placeholder={t("hostGroups.descriptionPlaceholder")}
                    onChange={(event) =>
                      setEditing({ ...editing, description: event.target.value })
                    }
                  />
                </CCol>

                <CCol md={12}>
                  <CFormLabel htmlFor="group-hosts">
                    {t("hostGroups.form.hosts")}
                    <span className="text-body-secondary fw-normal ms-2">
                      {t("hostGroups.form.hostCount", {
                        count: editing.hosts.length,
                      })}
                    </span>
                  </CFormLabel>
                  <CFormTextarea
                    id="group-hosts"
                    className="mono"
                    rows={9}
                    value={editing.hosts.join("\n")}
                    placeholder={"web-01.internal\nweb-02.internal\nweb-03.internal"}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        hosts: event.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <div className="form-text">
                    {t("hostGroups.form.hostsHint")}
                  </div>
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
          <CModalTitle>{t("hostGroups.delete.title")}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="mb-2">
            {t("hostGroups.delete.body", {
              name: pendingDelete?.name ?? "",
              count: pendingDelete?.hosts.length ?? 0,
            })}
          </p>

          {pendingDelete && pendingDelete.usedByCount > 0 && (
            <CAlert color="warning" className="d-flex align-items-start gap-2 mb-0">
              <CIcon icon={cilWarning} className="mt-1 flex-shrink-0" />
              <div className="small">
                {t("hostGroups.usedBy", { count: pendingDelete.usedByCount })} —{" "}
                {t("hostGroups.delete.orphanWarning")}
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
