import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RunsView from "@/components/runs/RunsView";
import { runsApi } from "@/lib/api/endpoints";
import type { PageResponse, RunPayload } from "@/lib/api/types";

vi.mock("@/lib/api/endpoints", () => ({
  runsApi: { list: vi.fn(), get: vi.fn(), cancel: vi.fn() },
}));

function run(overrides: Partial<RunPayload> = {}): RunPayload {
  return {
    id: 1,
    runRef: "run-1",
    actionRef: "act-1",
    definitionId: 14,
    toolName: "bireysel_local_yaanidb",
    actionName: "Yeni sorgu",
    actorLabel: "ufuk@yaani.com",
    purpose: "execute",
    status: "succeeded",
    error: null,
    statement: "SELECT count(*) FROM tblAccounts",
    startedAt: "2026-08-31T13:00:00.000Z",
    finishedAt: "2026-08-31T13:00:00.400Z",
    targets: [
      {
        address: "127.0.0.1",
        status: "succeeded",
        exitCode: 0,
        durationMs: 26,
        stdoutExcerpt: null,
        stderrExcerpt: null,
        rows: [{ "count(*)": 585 }],
      },
    ],
    ...overrides,
  };
}

function page(content: RunPayload[]): PageResponse<RunPayload> {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
    last: true,
  };
}

const listed = vi.mocked(runsApi.list);

/**
 * The history the gateway has always kept and nothing showed.
 *
 * A run that finished after the console was closed left no trace anyone could look at;
 * a failure an hour ago could only be found by querying the database directly.
 */
describe("RunsView", () => {
  beforeEach(() => {
    listed.mockReset();
  });

  it("lists what has run", async () => {
    listed.mockResolvedValue(page([run()]));

    render(<RunsView />);

    expect(await screen.findByText("bireysel_local_yaanidb")).toBeInTheDocument();
    expect(screen.getByText(/ufuk@yaani\.com/)).toBeInTheDocument();
  });

  it("shows the statement and the rows only once a row is opened", async () => {
    // Collapsed by default: a page of runs is for finding one, and every result opened at
    // once would bury the list it is meant to be read from.
    const user = userEvent.setup();
    listed.mockResolvedValue(page([run()]));

    render(<RunsView />);
    const row = await screen.findByText("bireysel_local_yaanidb");

    expect(screen.queryByText(/SELECT count/)).not.toBeInTheDocument();

    await user.click(row);

    expect(screen.getByText(/SELECT count/)).toBeInTheDocument();
    expect(screen.getByText("585")).toBeInTheDocument();
  });

  it("marks a schema read as this stack's own work", async () => {
    // Unlabelled it looks like a call somebody made and cannot account for.
    listed.mockResolvedValue(page([run({ purpose: "introspect" })]));

    render(<RunsView />);

    expect(await screen.findByText(/şema okuma|schema read/i)).toBeInTheDocument();
  });

  it("reports a failure with its reason", async () => {
    const user = userEvent.setup();
    listed.mockResolvedValue(
      page([
        run({
          status: "failed",
          error: "the statement failed: Table 'yaanidb.personal_data' doesn't exist",
          targets: [],
        }),
      ]),
    );

    render(<RunsView />);
    await user.click(await screen.findByText("bireysel_local_yaanidb"));

    expect(screen.getByText(/personal_data/)).toBeInTheDocument();
  });

  it("offers a retry rather than an empty table when the request fails", async () => {
    // The logs page showed "no records" for a 503 and the tab badges still said 41.
    listed.mockRejectedValue(new Error("A storage backend is unavailable"));

    render(<RunsView />);

    expect(await screen.findByText(/storage backend/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yeniden dene|try again/i })).toBeInTheDocument();
  });

  it("says so when there is nothing yet", async () => {
    listed.mockResolvedValue(page([]));

    render(<RunsView />);

    expect(await screen.findByText(/henüz bir çalıştırma|nothing has been run/i))
      .toBeInTheDocument();
  });
});
