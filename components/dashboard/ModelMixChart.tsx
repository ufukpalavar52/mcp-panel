"use client";

import { CChart } from "@coreui/react-chartjs";
import type { ModelUsagePayload } from "@/lib/api/types";

export default function ModelMixChart({ usage }: { usage: ModelUsagePayload[] }) {
  return (
    <CChart
      type="doughnut"
      height={220}
      style={{ "--chart-height": "220px" } as React.CSSProperties}
      data={{
        labels: usage.map((row) => row.modelLabel),
        datasets: [
          {
            data: usage.map((row) => row.calls),
            // Cycled, so a fourth model does not fall off the palette.
            backgroundColor: usage.map(
              (_, index) => ["#ea580c", "#0ea5e9", "#14b8a6", "#a855f7", "#84cc16"][index % 5],
            ),
            borderWidth: 0,
            hoverOffset: 6,
              },
        ],
      }}
      options={{
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, boxWidth: 8, padding: 16 },
          },
        },
      }}
    />
  );
}
