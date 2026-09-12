"use client";

import { useEffect, useState } from "react";
import { CBadge, CSpinner } from "@coreui/react";
import { CopyResults, TargetResult } from "@/components/runs/ResultView";
import { runsApi } from "@/lib/api/endpoints";
import { useT } from "@/lib/i18n";
import type { RunPayload } from "@/lib/api/types";

/** How long to keep asking, and how often.
 *
 * Twelve minutes at two seconds. Two used to be enough because every command ended in
 * seconds; a followed one runs for as long as its window, up to ten minutes, and giving up
 * at two would abandon the screen halfway through the log it was showing.
 */
const INTERVAL_MS = 2000;
const ATTEMPTS = 360;

/** The three ends a run can come to, each with the label and colour it is shown in. */
const FINISHED = {
  succeeded: { key: "console.outcome.succeeded", colour: "success" },
  failed: { key: "console.outcome.failed", colour: "danger" },
  cancelled: { key: "console.outcome.cancelled", colour: "warning" },
} as const;

type Finished = keyof typeof FINISHED;

function finished(status: RunPayload["status"]): status is Finished {
  return status in FINISHED;
}

/**
 * What the executor actually did, once it has done it.
 *
 * The console used to end at "queued", which is where the interesting part begins: a
 * report was dispatched, ran in nineteen milliseconds and its rows went nowhere anybody
 * could see. Dispatch is not an answer to "list the runs" — the rows are.
 *
 * Polled rather than pushed. The result travels by queue to the gateway, which writes it
 * down; there is no channel from there to a browser, and asking every two seconds for the
 * couple of seconds a run usually takes is cheaper than building one.
 */
export default function RunOutcome({
  runRef,
  onFinished,
}: {
  runRef: string;
  /**
   * Called once, when the run reaches an end.
   *
   * A finished run is the moment the goal loop may have written the next step, and there
   * is no channel from the gateway to a browser to say so. The console asks then rather
   * than polling the conversation on its own timer.
   */
  onFinished?: () => void;
}) {
  const t = useT();
  const [run, setRun] = useState<RunPayload | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const ask = async () => {
      attempts += 1;

      try {
        const current = await runsApi.get(runRef);
        if (cancelled) return;

        setRun(current);

        if (finished(current.status)) {
          onFinished?.();
          return;
        }
      } catch {
        // A miss is expected on the first ask or two — the row is written as the request
        // returns, and a 404 here means "not yet", not "never".
        if (cancelled) return;
      }

      if (attempts >= ATTEMPTS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(ask, INTERVAL_MS);
    };

    void ask();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // onFinished deliberately out of the deps: a caller that rebuilds it every render
    // would restart the poll on every render, and this effect owns a timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runRef]);

  if (gaveUp) {
    return <div className="small text-body-secondary mt-2">{t("console.outcome.slow")}</div>;
  }

  // Still going. A followed command sends its output on while it runs, so there may
  // already be something to read — and for `tail -f` that is the entire point: waiting for
  // the end means waiting for something that does not come.
  if (!run || !finished(run.status)) {
    return (
      <div className="mt-2">
        <div className="small text-body-secondary d-flex align-items-center gap-2">
          <CSpinner size="sm" />
          {run?.targets.length ? t("console.outcome.streaming") : t("console.outcome.waiting")}
        </div>

        {run?.targets.map((target) => (
          <TargetResult key={target.address} target={target} />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
        <CBadge color={FINISHED[run.status].colour}>{t(FINISHED[run.status].key)}</CBadge>
        {run.finishedAt && (
          <span className="small text-body-secondary">
            {new Date(run.finishedAt).toLocaleTimeString()}
          </span>
        )}

        {/* Beside the outcome, because that is where somebody looks once they have decided
            the answer is the one they wanted. */}
        <span className="ms-auto">
          <CopyResults targets={run.targets} />
        </span>
      </div>

      {run.error && <div className="small text-danger-emphasis mb-2">{run.error}</div>}

      {/* What was actually sent. The plan above says the same thing, but a run kept in the
          history is read on its own later, and by then the plan is gone. */}
      {run.statement && (
        <pre className="mono small bg-body-tertiary border rounded-3 p-2 mb-2 text-body overflow-auto">
          {run.statement}
        </pre>
      )}

      {run.targets.map((target) => (
        <TargetResult key={target.address} target={target} />
      ))}

    </div>
  );
}
