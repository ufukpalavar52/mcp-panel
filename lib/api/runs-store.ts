"use client";

import { useCallback, useEffect, useState } from "react";
import { runsApi } from "./endpoints";
import type { PageResponse, RunPayload } from "./types";

/**
 * The run history.
 *
 * Paged server side rather than cached in a module store, for the same reason the log
 * search is: the set grows without bound and every page is a different query. The other
 * collections here — models, definitions, host groups — are small and whole.
 */
export function useRuns(page: number, size = 20) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    page: PageResponse<RunPayload> | null;
    error: string | null;
  } | null>(null);

  const requestKey = JSON.stringify({ page, size, attempt });

  useEffect(() => {
    let cancelled = false;

    runsApi
      .list(page, size)
      .then((fetched) => {
        if (!cancelled) setResult({ key: requestKey, page: fetched, error: null });
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
  }, [requestKey, page, size]);

  const settled = result?.key === requestKey ? result : null;

  return {
    runs: settled?.page?.content ?? [],
    totalElements: settled?.page?.totalElements ?? 0,
    isLast: settled?.page?.last ?? true,
    loading: settled === null,
    error: settled?.error ?? null,
    reload: useCallback(() => setAttempt((current) => current + 1), []),
  };
}
