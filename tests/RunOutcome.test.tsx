import { render, screen, waitFor } from "@testing-library/react";
import { inTerminal } from "./terminal";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RunOutcome from "@/components/console/RunOutcome";
import { runsApi } from "@/lib/api/endpoints";
import type { RunPayload } from "@/lib/api/types";

vi.mock("@/lib/api/endpoints", () => ({
  runsApi: { get: vi.fn() },
}));

/** A run in whatever state a test needs, with everything else filled in. */
function run(overrides: Partial<RunPayload> = {}): RunPayload {
  return {
    id: 1,
    runRef: "run-1",
    actionRef: "act-1",
    definitionId: 14,
    toolName: "report",
    actionName: "Query",
    actorLabel: "tester",
    purpose: "execute",
    status: "succeeded",
    error: null,
    statement: "SELECT domain, count(*) FROM tblAccounts GROUP BY domain",
    startedAt: "2026-08-31T13:00:00Z",
    finishedAt: "2026-08-31T13:00:01Z",
    steps: null,
    targets: [
      {
        address: "127.0.0.1",
        status: "succeeded",
        exitCode: 0,
        durationMs: 26,
        stdoutExcerpt: null,
        stderrExcerpt: null,
        rows: [
          { domain: "test.com", count: 493 },
          { domain: "yaani.com", count: 4 },
        ],
      },
    ],
    ...overrides,
  };
}

const asked = vi.mocked(runsApi.get);

/**
 * What the console shows once a run has finished.
 *
 * The screen used to end at "queued": a report was dispatched, ran in nineteen
 * milliseconds and its rows went nowhere anybody could see. Every case below is one that
 * looked identical to a person before this component existed.
 */
describe("RunOutcome", () => {
  beforeEach(() => {
    asked.mockReset();
  });

  it("draws the rows as a table rather than as text", async () => {
    asked.mockResolvedValue(run());

    render(<RunOutcome runRef="run-1" />);

    // Column names come from the row's keys, so a header proves the structured path was
    // used — a flattened string would have put them inside one cell.
    expect(await screen.findByRole("columnheader", { name: "domain" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "count" })).toBeInTheDocument();
    expect(screen.getByText("493")).toBeInTheDocument();
  });

  it("says a query matched nothing instead of showing a blank", async () => {
    // An empty result is an answer. Blank space reads as something having gone wrong.
    asked.mockResolvedValue(
      run({ targets: [{ ...run().targets[0], rows: [] }] }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByText(/hiçbir kayıt|matched no rows/i)).toBeInTheDocument();
  });

  it("shows a command's output as text, not as a table", async () => {
    asked.mockResolvedValue(
      run({
        targets: [
          {
            ...run().targets[0],
            rows: null,
            stdoutExcerpt: "active (running) since Mon",
          },
        ],
      }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByText(/active \(running\)/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a command's output even when the rows field came back empty", async () => {
    /*
     * The one that made the console look broken. An empty array is truthy, so every SSH
     * command took the table branch and had "matched no rows" drawn over the top of the
     * output it had actually produced. A table with nothing in it is a query's answer; it
     * is never a command's.
     */
    asked.mockResolvedValue(
      run({
        statement: "systemctl status httpd",
        targets: [
          {
            ...run().targets[0],
            rows: [],
            stdoutExcerpt: "active (running) since Mon",
          },
        ],
      }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByText(/active \(running\)/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/hiçbir kayıt|matched no rows/i)).not.toBeInTheDocument();
  });

  it("shows what a running command has printed so far", async () => {
    /*
     * The whole point of following. `tail -f` never ends, so a screen that waits for the
     * outcome before showing anything shows nothing at all — which is what it did.
     */
    asked.mockResolvedValue(
      run({
        status: "running",
        finishedAt: null,
        statement: "tail -f /var/log/messages",
        targets: [
          {
            address: "10.0.0.1",
            status: "running",
            exitCode: null,
            durationMs: null,
            stdoutExcerpt: "Sep  5 10:00:01 web-01 sshd[1]: Accepted publickey",
            stderrExcerpt: null,
            rows: null,
          },
        ],
      }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByText(/Accepted publickey/)).toBeInTheDocument();
    expect(screen.getByText(/çıktı|output so far/i)).toBeInTheDocument();
  });

  it("draws a table from a REST answer and keeps the answer itself", async () => {
    /*
     * A REST body is a table wearing a different coat, and a search for eleven users read
     * as a paragraph of JSON. The rows are read out of it — but a listing endpoint puts a
     * count and its paging beside them, so what came back stays one click away rather than
     * being replaced.
     */
    asked.mockResolvedValue(
      run({
        statement: "GET http://h/api/users",
        targets: [
          {
            address: "http://h/api/users",
            status: "succeeded",
            exitCode: 200,
            durationMs: 12,
            stdoutExcerpt: '{"count":1,"data":[{"id":102,"first_name":"Mehmet"}]}',
            stderrExcerpt: null,
            rows: [{ id: 102, first_name: "Mehmet" }],
          },
        ],
      }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByRole("columnheader", { name: "first_name" })).toBeInTheDocument();
    // In the table, specifically. The raw body below it holds the same number, and now
    // paints it — a bare text match would pass on either and prove neither.
    expect(screen.getByRole("cell", { name: "102" })).toBeInTheDocument();

    // Folded away, not thrown away.
    expect(screen.getByText(/ham yanıt|raw response/i)).toBeInTheDocument();
    expect(screen.getByText(inTerminal(/"count":1/))).toBeInTheDocument();
  });

  it("offers to copy a finished result", async () => {
    const user = userEvent.setup();
    const written: string[] = [];

    // Defined rather than assigned: jsdom's navigator.clipboard is a getter, and
    // userEvent.setup() installs its own on top of it.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    });

    asked.mockResolvedValue(run());

    render(<RunOutcome runRef="run-1" />);
    await user.click(await screen.findByRole("button", { name: /kopyala|copy/i }));

    expect(written).toEqual(["domain\tcount\ntest.com\t493\nyaani.com\t4"]);
    expect(await screen.findByText(/kopyalandı|copied/i)).toBeInTheDocument();
  });

  it("offers nothing to copy when there is nothing that succeeded", async () => {
    // A button that copies an empty string looks broken in exactly the way a button that
    // does nothing does.
    asked.mockResolvedValue(
      run({ status: "failed", error: "boom", targets: [] }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByText(/boom/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /kopyala|copy/i })).not.toBeInTheDocument();
  });

  it("keeps asking while the run is still going", async () => {
    asked
      .mockResolvedValueOnce(run({ status: "running", targets: [] }))
      .mockResolvedValue(run());

    render(<RunOutcome runRef="run-1" />);

    // The first answer is not an outcome, so nothing is shown yet.
    expect(await screen.findByText(/bekleniyor|Waiting/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it("reports why a run failed", async () => {
    // "failed" with no reason is what the recorder used to store, and it answered nothing.
    asked.mockResolvedValue(
      run({
        status: "failed",
        error: "the statement failed: Table 'yaanidb.personal_data' doesn't exist",
        targets: [],
      }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByText(/personal_data/)).toBeInTheDocument();
  });

  it("shows the statement that ran", async () => {
    // For a dynamic action this is the only record of what the model wrote.
    asked.mockResolvedValue(run());

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByText(/GROUP BY domain/)).toBeInTheDocument();
  });
});

/**
 * A job approved whole runs several actions under one reference.
 *
 * "Write the script" and "run the script" are one decision and one job. Looking it up
 * returned only the first action, so the console showed the write — which prints nothing —
 * while the output somebody had been waiting for sat unread behind it. The run had
 * succeeded; the screen said nothing had come back.
 */
describe("a job with several actions", () => {
  it("shows the output of every action, not just the first", async () => {
    vi.mocked(runsApi.get).mockResolvedValue(
      run({
        actionName: "Dosyayi yaz",
        statement: "cat > /tmp/fib.py <<'E'\nprint(1)\nE",
        targets: [
          {
            address: "192.168.139.110",
            status: "succeeded",
            exitCode: 0,
            durationMs: 10,
            stdoutExcerpt: "(no output)",
            stderrExcerpt: null,
            rows: null,
          },
        ],
        steps: [
          run({
            actionName: "Dosyayi yaz",
            statement: "cat > /tmp/fib.py <<'E'\nprint(1)\nE",
            targets: [
              {
                address: "192.168.139.110",
                status: "succeeded",
                exitCode: 0,
                durationMs: 10,
                stdoutExcerpt: "(no output)",
                stderrExcerpt: null,
                rows: null,
              },
            ],
          }),
          run({
            actionRef: "act-2",
            actionName: "Dosyayi calistir",
            statement: "python3 /tmp/fib.py",
            targets: [
              {
                address: "192.168.139.110",
                status: "succeeded",
                exitCode: 0,
                durationMs: 40,
                stdoutExcerpt: "[0, 1, 1, 2, 3, 5]",
                stderrExcerpt: null,
                rows: null,
              },
            ],
          }),
        ],
      }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(await screen.findByText(inTerminal(/\[0, 1, 1, 2, 3, 5\]/))).toBeInTheDocument();
    expect(screen.getByText(inTerminal(/python3 \/tmp\/fib\.py/))).toBeInTheDocument();
    expect(screen.getByText("Dosyayi calistir")).toBeInTheDocument();
  });

  it("names nothing when the job had one action", async () => {
    vi.mocked(runsApi.get).mockResolvedValue(run({ actionName: "Query" }));

    render(<RunOutcome runRef="run-1" />);
    await screen.findByText(inTerminal(/SELECT domain/));

    expect(screen.queryByText("Query")).toBeNull();
  });
});

/**
 * The poll used to stop on the first action and miss the output of the second.
 *
 * `cat > file` finishes in a moment; the command that runs the file is still going. The
 * card read the top-level status — the write's — declared the job done and stopped asking.
 * The output arrived afterwards, to a screen that had stopped looking, and the person saw
 * a finished run that had printed nothing.
 */
describe("a job whose first action finishes before the rest", () => {
  function twoSteps(second: Partial<RunPayload>) {
    return run({
      steps: [
        run({ actionName: "yaz", status: "succeeded" }),
        run({ actionRef: "act-2", actionName: "calistir", ...second }),
      ],
    });
  }

  it("keeps waiting while a later action is still running", async () => {
    vi.mocked(runsApi.get).mockResolvedValue(
      twoSteps({ status: "running", targets: [] }),
    );

    render(<RunOutcome runRef="run-1" />);

    expect(
      await screen.findByText(/çalışıyor|running|bekleniyor|waiting/i),
    ).toBeInTheDocument();
  });

  it("reports the job as failed when a later action failed", async () => {
    /* A script that was written and then would not run is a failure, whatever the write
       says. Badging it from the first action would claim the opposite. */
    vi.mocked(runsApi.get).mockResolvedValue(
      twoSteps({
        status: "failed",
        targets: [
          {
            address: "192.168.139.110",
            status: "failed",
            exitCode: 1,
            durationMs: 5,
            stdoutExcerpt: null,
            stderrExcerpt: "SyntaxError",
            rows: null,
          },
        ],
      }),
    );

    render(<RunOutcome runRef="run-1" />);

    // Twice over: the job says it failed, and so does the step that failed. Which one it
    // was matters as much as that one did — in a job of several, "failed" on its own sends
    // somebody looking through output that is perfectly fine.
    expect(await screen.findAllByText(/başarısız|failed/i)).toHaveLength(2);
  });
});

