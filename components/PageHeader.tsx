import React from "react";

export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
      <div>
        <h1 className="h4 fw-semibold mb-1">{title}</h1>
        {description && (
          <p className="text-body-secondary mb-0 small">{description}</p>
        )}
      </div>
      {actions && <div className="d-flex gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
