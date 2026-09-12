"use client";

import CIcon from "@coreui/icons-react";
import { cilCheckCircle, cilXCircle } from "@coreui/icons";
import { CToast, CToastBody, CToastClose, CToaster } from "@coreui/react";
import { useT } from "@/lib/i18n";
import { dismissToast, useToasts, type Toast } from "@/lib/ui/toast-store";

/**
 * Shows the outcome of whatever the user just did.
 *
 * Mounted once in the panel shell. Before this, a create, a delete or a toggle finished in
 * silence — and a failure finished in the same silence, which meant a rejected save looked
 * exactly like a successful one.
 */
export default function Toaster() {
  const toasts = useToasts();

  return (
    <CToaster placement="bottom-end" className="p-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </CToaster>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const t = useT();
  const failed = toast.kind === "failure";

  return (
    <CToast
      visible
      color={failed ? "danger" : "success"}
      className="text-white align-items-center"
      // A failure stays until it is dismissed. It usually needs acting on, and a message
      // that removes itself while being read is worse than no message.
      autohide={!failed}
      delay={4000}
      onClose={() => dismissToast(toast.id)}
    >
      <div className="d-flex">
        <CToastBody className="d-flex align-items-start gap-2">
          <CIcon
            icon={failed ? cilXCircle : cilCheckCircle}
            className="mt-1 flex-shrink-0"
          />
          <span>
            {/* A failure usually carries the gateway's own text; when it carries a key
                instead, the panel wrote the sentence and it follows the language. */}
            {failed && toast.text
              ? toast.text
              : t(toast.messageKey ?? "toast.saved", toast.params)}
          </span>
        </CToastBody>
        <CToastClose className="me-2 m-auto" white />
      </div>
    </CToast>
  );
}
