"use client";

import { CChart } from "@coreui/react-chartjs";
import { useT, useIntlLocale } from "@/lib/i18n";
import type { DailyCallCountPayload } from "@/lib/api/types";

export default function CallsChart({ series }: { series: DailyCallCountPayload[] }) {
  const t = useT();
  const intlLocale = useIntlLocale();

  const labels = series.map((point) =>
    new Date(point.day).toLocaleDateString(intlLocale, { day: "2-digit", month: "short" }),
  );

  return (
    <CChart
      type="line"
      height={280}
      style={{ "--chart-height": "280px" } as React.CSSProperties}
      data={{
        labels,
        datasets: [
          {
            label: t("dashboard.calls.success"),
            data: series.map((point) => point.succeeded),
            borderColor: "#ea580c",
            backgroundColor: "rgba(234, 88, 12, 0.12)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.35,
            fill: true,
          },
          {
            label: t("dashboard.calls.failed"),
            data: series.map((point) => point.failed),
            borderColor: "#e11d48",
            backgroundColor: "rgba(225, 29, 72, 0.1)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.35,
            fill: true,
          },
        ],
      }}
      options={{
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: { usePointStyle: true, boxWidth: 8, padding: 16 },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, border: { display: false } },
        },
      }}
    />
  );
}
