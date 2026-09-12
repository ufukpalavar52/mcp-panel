import { render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByText("102")).toBeInTheDocument();

    // Folded away, not thrown away.
    expect(screen.getByText(/ham yanıt|raw response/i)).toBeInTheDocument();
    expect(screen.getByText(/"count":1/)).toBeInTheDocument();
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
