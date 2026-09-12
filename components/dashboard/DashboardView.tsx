"use client";

import Link from "next/link";
import {
  cilBolt,
  cilPuzzle,
  cilLayers,
  cilCode,
} from "@coreui/icons";
import {
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CProgress,
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
import CallsChart from "@/components/dashboard/CallsChart";
import ModelMixChart from "@/components/dashboard/ModelMixChart";
import { useDashboardData } from "@/lib/api/dashboard-store";
import { useIntlLocale } from "@/lib/i18n";
import { modelStatusMeta, useModels } from "@/lib/models-store";
import { useDefinitions } from "@/lib/definitions-store";
import { useT } from "@/lib/i18n";

export default function DashboardView() {
  const models = useModels();
  const definitions = useDefinitions();
  const t = useT();
  const intlLocale = useIntlLocale();
  const { data } = useDashboardData();

  const activeModels = models.filter(
    (model) => model.enabled && model.status === "online",
  ).length;
  const activeTools = definitions.filter((item) => item.enabled).length;
  // Summaries carry counts per kind rather than the actions themselves.
  const actionCount = definitions.reduce(
    (sum, item) =>
      sum + Object.values(item.actionCountsByKind).reduce((inner, n) => inner + n, 0),
    0,
  );

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
      />

      <CRow className="g-3 mb-4">
        <CCol sm={6} xl={3}>
          <StatCard
            label={t("dashboard.stat.activeModels")}
            value={`${activeModels}/${models.length}`}
            icon={cilLayers}
          />
        </CCol>
        <CCol sm={6} xl={3}>
          <StatCard
            label={t("dashboard.stat.publishedTools")}
            value={`${activeTools}/${definitions.length}`}
            icon={cilPuzzle}
            color="info"
          />
        </CCol>
        <CCol sm={6} xl={3}>
          <StatCard
            label={t("dashboard.stat.dailyCalls")}
            value={data.totalCalls.toLocaleString(intlLocale)}
            icon={cilBolt}
            color="success"
          />
        </CCol>
        <CCol sm={6} xl={3}>
          <StatCard
            label={t("dashboard.stat.definedActions")}
            value={String(actionCount)}
            icon={cilCode}
            color="danger"
          />
        </CCol>
      </CRow>

      <CRow className="g-3 mb-4">
        <CCol xl={8}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent d-flex align-items-center justify-content-between">
              <div>
                <div className="fw-semibold">{t("dashboard.calls.title")}</div>
                <div className="small text-body-secondary">{t("dashboard.calls.range")}</div>
              </div>
              <CBadge color="primary" shape="rounded-pill">
                {t("dashboard.calls.live")}
              </CBadge>
            </CCardHeader>
            <CCardBody>
              <CallsChart series={data.timeseries} />
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xl={4}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent fw-semibold">
              {t("dashboard.modelMix")}
            </CCardHeader>
            <CCardBody>
              <ModelMixChart usage={data.modelUsage} />
              <div className="mt-4">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="text-body-secondary">{t("dashboard.quota")}</span>
                  <span className="fw-semibold">%68</span>
                </div>
                <CProgress value={68} height={8} color="primary" />
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="g-3">
        <CCol xl={7}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent d-flex align-items-center justify-content-between">
              <span className="fw-semibold">{t("dashboard.modelStatus")}</span>
              <Link href="/models" className="small text-decoration-none">
                {t("common.seeAll")}
              </Link>
            </CCardHeader>
            <CCardBody className="pt-0">
              <CTable align="middle" hover responsive className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>{t("common.model")}</CTableHeaderCell>
                    <CTableHeaderCell>{t("common.status")}</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">
                      {t("common.latency")}
                    </CTableHeaderCell>
                    <CTableHeaderCell className="text-end">
                      {t("dashboard.definitions")}
                    </CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {models.slice(0, 5).map((model) => (
                    <CTableRow key={model.id}>
                      <CTableDataCell>
                        <div className="fw-semibold mono">{model.modelId}</div>
                        <div className="small text-body-secondary">
                          {model.name}
                        </div>
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
                      <CTableDataCell className="text-end mono">
                        {model.latencyMs ? `${model.latencyMs} ms` : "—"}
                      </CTableDataCell>
                      <CTableDataCell className="text-end mono">
                        {
                          model.definitionCount
                        }
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={5}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent fw-semibold">
              {t("dashboard.activity")}
            </CCardHeader>
            <CCardBody>
              {data.activity.length === 0 ? (
                <p className="small text-body-secondary mb-0 text-center py-3">
                  {t("dashboard.activityEmpty")}
                </p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {data.activity.map((event, index) => (
                    <li
                      key={event.id}
                      className={`d-flex gap-3 ${
                        index === data.activity.length - 1
                          ? ""
                          : "pb-3 mb-3 border-bottom"
                      }`}
                    >
                      <span className="avatar-initials bg-primary-subtle text-primary">
                        {event.actorLabel.charAt(0).toLocaleUpperCase("tr")}
                      </span>
                      <div className="flex-grow-1">
                        <div className="small">
                          <span className="fw-semibold">{event.actorLabel}</span>{" "}
                          <span className="mono">{event.action}</span>
                        </div>
                        <div className="small text-body-secondary">
                          {new Date(event.createdAt).toLocaleString(intlLocale)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}
