"use client";

import { useEffect, useState } from "react";
import { logsApi } from "./endpoints";
import type { PageResponse, ToolCallPayload } from "./types";

export type LogFilters = {
  level?: string;
  tool?: string;
  search?: string;
  page: number;
};

/**
 * Log search.
 *
 * Unlike the other collections this one is not cached in a module store: every filter
 * change is a different query, and the result set grows without bound, so paging and
 * filtering are delegated to the gateway rather than done over a cached array.
 */
export function useLogSearch(filters: LogFilters) {
  const { level, tool, search, page: pageNumber } = filters;

  // Counted so that a retry is a different query. Without it the key after a failure is
  // the key that already settled, and pressing "try again" changes nothing.
  const [attempt, setAttempt] = useState(0);

  // One key per distinct query. Loading is derived by comparing it with the key of the
  // last completed request, which avoids setting state synchronously inside the effect
  // and keeps the flag correct when filters change while a request is still open.
  const requestKey = JSON.stringify({
    level,
    tool,
    search,
    pageNumber,
    attempt,
  });

  const [result, setResult] = useState<{
    key: string;
    page: PageResponse<ToolCallPayload> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    logsApi
      .search({ level, tool, search, page: pageNumber })
      .then((page) => {
        if (!cancelled) setResult({ key: requestKey, page, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            page: null,
            error: cause instanceof Error ? cause.message : "Bilinmeyen hata",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, level, tool, search, pageNumber]);

  const settled = result?.key === requestKey ? result : null;

  return {
    entries: settled?.page?.content ?? [],
    totalElements: settled?.page?.totalElements ?? 0,
    totalPages: settled?.page?.totalPages ?? 0,
    isLast: settled?.page?.last ?? true,
    loading: settled === null,
    error: settled?.error ?? null,
    reload: () => setAttempt((current) => current + 1),
  };
}

export function useLogCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    logsApi
      .counts()
      .then((result) => {
        if (!cancelled) setCounts(result);
      })
      .catch(() => {
        // Tab badges are decoration; a failure here must not break the page.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}
