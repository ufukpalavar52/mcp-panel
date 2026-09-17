"use client";

import { useEffect, useState } from "react";
import { Terminal } from "@/components/ui/Terminal";
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
 * The outcome of the job as a whole.
 *
 * A job is only as good as its worst action: a script that was written and then failed to
 * run is a failure, and badging it with the write's success would say the opposite of what
 * happened.
 */
function worst(run: RunPayload): Finished {
  const all = (run.steps ?? [run]).map((step) => step.status).filter(finished);

  return all.find((status) => status !== "succeeded") ?? "succeeded";
}

/**
 * Whether the whole job is done, rather than its first action.
 *
 * A job approved whole runs several actions under one reference, and the fields at the top
 * belong to the first of them. `cat > file` finishes in a moment while the command that
 * runs the file is still going — so reading the top-level status alone declared the job
 * finished, stopped the poll, and left the screen showing the action that prints nothing.
 * The output arrived afterwards, to a card that had stopped looking.
 */
function settled(run: RunPayload): boolean {
  return run.steps && run.steps.length > 0
    ? run.steps.every((step) => finished(step.status))
    : finished(run.status);
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

        if (settled(current)) {
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
  if (!run || !settled(run)) {
    return (
      <div className="mt-2">
        <div className="small text-body-secondary d-flex align-items-center gap-2">
          <CSpinner size="sm" />
          {run?.targets.length ? t("console.outcome.streaming") : t("console.outcome.waiting")}
        </div>

        {/* Every action's output, not the first one's: the second is usually the one
            still running, and the one somebody is watching for. */}
        {(run?.steps ?? (run ? [run] : [])).flatMap((step) =>
          step.targets.map((target) => (
            <TargetResult key={`${step.actionRef}-${target.address}`} target={target} />
          )),
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
        <CBadge color={FINISHED[worst(run)].colour}>{t(FINISHED[worst(run)].key)}</CBadge>
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

      {/* One block per action. A job approved whole carries several — "write the script"
          then "run the script" — and showing only the first showed the one that prints
          nothing while the output somebody was waiting for sat unread behind it.

          What was actually sent is kept beside each result: the plan above says the same
          thing, but a run read from the history later has no plan next to it. */}
      {(run.steps ?? [run]).map((step, index) => (
        <div key={step.actionRef ?? index}>
          {/* Numbered, because in a job of several the order is the point: the file is
              written before it is run, and a reader scanning two blocks of output needs to
              know which came first without reading either. */}
          {(run.steps?.length ?? 0) > 1 && (
            <div className="d-flex align-items-center gap-2 mb-1">
              <CBadge color="secondary" shape="rounded-pill">{index + 1}</CBadge>
              <span className="small fw-semibold">{step.actionName}</span>
              {finished(step.status) && (
                <CBadge color={FINISHED[step.status].colour} shape="rounded-pill">
                  {t(FINISHED[step.status].key)}
                </CBadge>
              )}
            </div>
          )}

          {step.statement && (
            <Terminal kind="command" className="mb-2">{step.statement}</Terminal>
          )}

          {step.targets.map((target) => (
            <TargetResult key={target.address} target={target} />
          ))}
        </div>
      ))}

    </div>
  );
}
