"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export default function NotFound() {
  const t = useT();

  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center vh-100 p-4">
      <div className="display-1 fw-bold text-primary">404</div>
      <h1 className="h4 fw-semibold mb-2">{t("notFound.title")}</h1>
      <p className="text-body-secondary mb-4">{t("notFound.body")}</p>
      <Link href="/dashboard" className="btn btn-primary">
        {t("notFound.back")}
      </Link>
    </div>
  );
}
