"use client";

import CIcon from "@coreui/icons-react";
import { cilReload, cilWarning } from "@coreui/icons";
import { CButton, CCard, CCardBody, CSpinner } from "@coreui/react";
import { useT } from "@/lib/i18n";

/**
 * Renders the three states every remote list shares: loading, failed and empty.
 *
 * Kept in one component so a page never invents its own spinner, and so a failed request
 * always offers a retry instead of leaving an empty table that looks like "no data".
 */
export default function ResourceState({
  loading,
  error,
  empty,
  onRetry,
  emptyMessage,
  emptyAction,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  emptyMessage: string;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <CCard>
        <CCardBody className="text-center py-5">
          <CIcon icon={cilWarning} size="xl" className="text-danger mb-2 d-block mx-auto" />
          <div className="fw-semibold mb-1">{t("resource.failed")}</div>
          <div className="small text-body-secondary mb-3">{error}</div>
          <CButton color="primary" variant="outline" onClick={onRetry}>
            <CIcon icon={cilReload} className="me-2" />
            {t("resource.retry")}
          </CButton>
        </CCardBody>
      </CCard>
    );
  }

  if (empty) {
    return (
      <CCard>
        <CCardBody className="text-center py-5">
          <div className="text-body-secondary mb-3">{emptyMessage}</div>
          {emptyAction}
        </CCardBody>
      </CCard>
    );
  }

  return <>{children}</>;
}
