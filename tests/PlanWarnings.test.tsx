import { render, screen } from "@testing-library/react";
import { inTerminal } from "./terminal";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConsoleView from "@/components/console/ConsoleView";
import { toolsApi } from "@/lib/api/endpoints";
import type { PlanPayload, PlanWarning } from "@/lib/api/types";

vi.mock("@/lib/api/endpoints", () => ({
  conversationsApi: { list: vi.fn(), get: vi.fn(), remove: vi.fn() },
  toolsApi: { prompt: vi.fn() },
  runsApi: { get: vi.fn(), cancel: vi.fn() },
}));

vi.mock("@/lib/api/tools-store", () => ({ useTools: () => [] }));
vi.mock("@/lib/api/conversations-store", () => ({
  PAGE_SIZE: 15,
  useConversations: () => ({
    data: [],
    page: 0,
    total: 0,
    search: "",
    loading: false,
    error: null,
  }),
  conversationsStore: { reload: vi.fn(), setPage: vi.fn(), setSearch: vi.fn() },
}));

function plan(warnings: PlanWarning[]): PlanPayload {
  return {
    tool: "hesaplar",
    definition_id: 1,
    model: "Qwen/Qwen3-235B-A22B-Instruct-2507",
    status: "planned",
    actions: [
      {
        action_id: 1,
        name: "Sorgu",
        kind: "db",
        mode: "dynamic",
        targets: [],
        resolved: "select count(*) from tblAccounts where domain = 'bireysel'",
        authored_by_model: true,
        rejected_reasons: [],
        requires_approval: false,
        skipped: false,
        skip_reason: "",
      },
    ],
    problems: [],
    warnings,
    masked_inputs: [],
  };
}

async function ask(warnings: PlanWarning[]) {
  vi.mocked(toolsApi.prompt).mockResolvedValue({
    conversationRef: "conv_1",
    turnId: 1,
    result: {
      answer: "",
      tool_name: "hesaplar",
      arguments: {},
      reasoning: "",
      problem: null,
      status: "planned",
      plan: plan(warnings),
      dispatch: null,
    },
  });

  const user = userEvent.setup();
  render(<ConsoleView />);
  await user.type(screen.getByRole("textbox", { name: /sorunuz|your question/i }), "kac tane hesap var");
  await user.click(screen.getByRole("button", { name: /gönder|send/i }));
}

/**
 * A query that narrowed on something nobody asked for.
 *
 * Asked how many accounts there were, the model filtered on a domain it had taken from the
 * action's own name and answered 0 where the answer was 585. Valid SQL, ran in twenty
 * milliseconds, reported success — and nothing on the screen said what it left out.
 */
describe("plan warnings", () => {
  beforeEach(() => {
    vi.mocked(toolsApi.prompt).mockReset();
    window.localStorage.clear();
  });

  it("shows what the query narrowed on", async () => {
    await ask([{ code: "unrequested_filter", detail: "domain = 'bireysel'" }]);

    // The statement contains the same text, so the assertion names the warning itself:
    // what matters is that it is called out, not that it appears somewhere on the page.
    // The list names the filter; the sentence beside it asks rather than asserts, because
    // "not in the request" is not the same as "nobody asked for it" — a Turkish question
    // about aktif accounts asks for exactly this status = 'active'.
    expect(await screen.findByText(/narrows on these values|değerlere göre daraltıyor/i))
      .toBeInTheDocument();
    expect(screen.getByText(/do not appear in the request|istekte geçmiyor/i))
      .toBeInTheDocument();
  });

  it("still shows the plan, because a warning is not a refusal", async () => {
    // Most queries filter and most filters are right. Refusing them would make dynamic
    // queries useless; the point is that the reader knows, not that the plan is blocked.
    await ask([{ code: "unrequested_filter", detail: "status = 'active'" }]);

    expect(await screen.findByText(inTerminal(/select count/))).toBeInTheDocument();
  });

  it("says nothing when there is nothing to say", async () => {
    await ask([]);

    await screen.findByText(inTerminal(/select count/));
    expect(screen.queryByText(/narrows on these values|daraltıyor/i)).not.toBeInTheDocument();
  });
});

/**
 * A repeat is caught by comparing statements, not by reading the sentence.
 *
 * The wording that produces one is endless: naming "list the results so far" in the
 * router's instructions fixed that shape, and "Önceki tüm sonuçları tablo olarak getir"
 * arrived the next day, re-ran a query from seven turns earlier and presented its rows as
 * all previous results.
 */
describe("a repeated statement", () => {
  beforeEach(() => {
    vi.mocked(toolsApi.prompt).mockReset();
    window.localStorage.clear();
  });

  it("says the query already ran in this conversation", async () => {
    await ask([
      { code: "repeats_earlier", detail: "SELECT id FROM tblAccounts WHERE email = 'x'" },
    ]);

    expect(
      await screen.findByText(/same query that already ran|daha önce çalışmış olanın aynısı/i),
    ).toBeInTheDocument();
  });

  it("says what to do about it", async () => {
    await ask([{ code: "repeats_earlier", detail: "SELECT 1" }]);

    expect(
      await screen.findByText(/say what should change|neyin değişmesi gerektiğini/i),
    ).toBeInTheDocument();
  });

  it("names a question turned into a value", async () => {
    // Half a typed message, sent by an early Enter, became where email = 'önceki t' —
    // valid SQL that cannot match anything, run and reported as a success.
    await ask([{ code: "request_as_value", detail: "email = 'önceki t'" }]);

    expect(
      await screen.findByText(/question itself as a value|sorunun kendisini bir değer/i),
    ).toBeInTheDocument();
  });
});
