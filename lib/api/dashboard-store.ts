"use client";

import { useEffect, useState } from "react";
import { auditApi, logsApi } from "./endpoints";
import type {
  AuditEventPayload,
  DailyCallCountPayload,
  ModelUsagePayload,
} from "./types";

/**
 * Everything the dashboard reads that is not already covered by another store.
 *
 * Fetched together in one effect: the three requests are independent and always shown
 * side by side, so issuing them in parallel is both simpler and faster than three hooks
 * that each rerender the page on their own.
 */
export type DashboardData = {
  timeseries: DailyCallCountPayload[];
  modelUsage: ModelUsagePayload[];
  activity: AuditEventPayload[];
  totalCalls: number;
  errorCalls: number;
};

const EMPTY: DashboardData = {
  timeseries: [],
  modelUsage: [],
  activity: [],
  totalCalls: 0,
  errorCalls: 0,
};

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      logsApi.timeseries(14),
      logsApi.byModel(),
      auditApi.recent(6),
      logsApi.counts(),
    ])
      .then(([timeseries, modelUsage, activity, counts]) => {
        if (cancelled) return;
        setData({
          timeseries,
          modelUsage,
          activity,
          totalCalls: counts.all ?? 0,
          errorCalls: counts.error ?? 0,
        });
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Bilinmeyen hata");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data: data ?? EMPTY, loading: data === null && error === null, error };
}

/**
 * Unread error count for the sidebar badge.
 *
 * Its own tiny store rather than part of the dashboard payload, because the sidebar is
 * mounted on every page while the dashboard is not.
 */
export function useErrorLogCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    logsApi
      .counts()
      .then((counts) => {
        if (!cancelled) setCount(counts.error ?? 0);
      })
      .catch(() => {
        // A badge is decoration; failing to load one must not disturb the shell.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
