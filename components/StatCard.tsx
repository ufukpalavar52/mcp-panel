import CIcon from "@coreui/icons-react";
import { cilArrowBottom, cilArrowTop } from "@coreui/icons";
import { CCard, CCardBody } from "@coreui/react";

export default function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  color = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  /** Percentage change: green when positive, red when negative. */
  delta?: number;
  icon: string[];
  color?: string;
}) {
  const up = (delta ?? 0) >= 0;

  return (
    <CCard className="stat-card h-100">
      <CCardBody className="d-flex align-items-start gap-3">
        <span className={`stat-icon bg-${color}-subtle text-${color}`}>
          <CIcon icon={icon} size="lg" />
        </span>
        <div className="flex-grow-1">
          <div className="text-body-secondary text-uppercase small fw-semibold">
            {label}
          </div>
          <div className="fs-3 fw-semibold lh-1 my-1">{value}</div>
          <div className="small d-flex align-items-center gap-2">
            {delta !== undefined && (
              <span className={up ? "text-success" : "text-danger"}>
                <CIcon icon={up ? cilArrowTop : cilArrowBottom} size="sm" />{" "}
                {Math.abs(delta)}%
              </span>
            )}
            {hint && <span className="text-body-secondary">{hint}</span>}
          </div>
        </div>
      </CCardBody>
    </CCard>
  );
}
