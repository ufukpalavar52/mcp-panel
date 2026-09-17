"use client";

import { useState } from "react";
import CIcon from "@coreui/icons-react";
import { cilEnvelopeClosed, cilOptions, cilShieldAlt } from "@coreui/icons";
import {
  CAvatar,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CDropdown,
  CDropdownHeader,
  CDropdownDivider,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import {
  userRoleColor,
  userRoleKeys,
  userStatusColor,
  userStatusKeys,
} from "@/lib/data";
import ResourceState from "@/components/ResourceState";
import { useUsers, useUsersStatus, usersStore } from "@/lib/api/users-store";
import AddUserModal from "./AddUserModal";
import { useT } from "@/lib/i18n";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("tr");
}

export default function UsersView() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const t = useT();
  const users = useUsers();
  const status = useUsersStatus();

  return (
    <>
      <PageHeader
        title={t("users.title")}
        description={t("users.subtitle")}
        actions={
          <CButton color="primary" onClick={() => setInviteOpen(true)}>
            <CIcon icon={cilEnvelopeClosed} className="me-2" />
            {t("users.add")}
          </CButton>
        }
      />

      <CRow className="g-3 mb-4">
        <CCol sm={4}>
          <StatCard label={t("users.stat.total")} value={String(users.length)} icon={cilShieldAlt} />
        </CCol>
        <CCol sm={4}>
          <StatCard
            label={t("users.stat.active")}
            value={String(users.filter((u) => u.status === "active").length)}
            icon={cilShieldAlt}
            color="success"
          />
        </CCol>
        <CCol sm={4}>
          <StatCard
            label={t("users.stat.pending")}
            value={String(users.filter((u) => u.status === "invited").length)}
            icon={cilEnvelopeClosed}
            color="info"
          />
        </CCol>
      </CRow>

      <ResourceState
        loading={status.loading}
        error={status.error}
        empty={users.length === 0}
        onRetry={status.reload}
        emptyMessage={t("users.emptyList")}
      >
      <CCard>
        <CCardBody className="pt-2">
          <CTable align="middle" hover responsive className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>{t("users.column.user")}</CTableHeaderCell>
                <CTableHeaderCell>{t("users.column.role")}</CTableHeaderCell>
                <CTableHeaderCell>{t("users.column.team")}</CTableHeaderCell>
                <CTableHeaderCell>{t("common.status")}</CTableHeaderCell>
                <CTableHeaderCell className="text-end">
                  {t("common.lastLogin")}
                </CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {users.map((user) => (
                <CTableRow key={user.id}>
                  <CTableDataCell>
                    <div className="d-flex align-items-center gap-3">
                      <CAvatar color="primary" textColor="white" size="md">
                        {initials(user.fullName)}
                      </CAvatar>
                      <div>
                        <div className="fw-semibold">{user.fullName}</div>
                        <div className="small text-body-secondary">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={userRoleColor[user.role]} shape="rounded-pill">
                      {t(userRoleKeys[user.role])}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="small">{user.team}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge
                      color={userStatusColor[user.status]}
                      shape="rounded-pill"
                      className="text-capitalize"
                    >
                      {t(userStatusKeys[user.status])}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="text-end small text-body-secondary">
                    {user.lastLoginAt ?? "—"}
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
                        aria-label={t("users.actionsLabel")}
                      >
                        <CIcon icon={cilOptions} />
                      </CDropdownToggle>
                      <CDropdownMenu>
                        {/* Disabled rather than removed: the menu is the shape this table
                            will have, and an empty one says less than a greyed-out one. */}
                        <CDropdownHeader className="small text-body-secondary">
                          {t("users.notWired")}
                        </CDropdownHeader>
                        <CDropdownItem disabled>{t("common.edit")}</CDropdownItem>
                        <CDropdownItem disabled>{t("users.changeRole")}</CDropdownItem>
                        <CDropdownDivider />
                        <CDropdownItem disabled className="text-danger">
                          {t("users.revoke")}
                        </CDropdownItem>
                      </CDropdownMenu>
                    </CDropdown>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
      </ResourceState>

      <AddUserModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onAdded={() => void usersStore.reload()}
      />

    </>
  );
}
