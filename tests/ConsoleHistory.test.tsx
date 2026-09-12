import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConsoleView from "@/components/console/ConsoleView";
import { conversationsApi, runsApi, toolsApi } from "@/lib/api/endpoints";
import type { ConversationPayload, ConversationTurnPayload } from "@/lib/api/types";

vi.mock("@/lib/api/endpoints", () => ({
  conversationsApi: { list: vi.fn(), get: vi.fn(), remove: vi.fn() },
  toolsApi: { prompt: vi.fn(), approveStep: vi.fn(), declineStep: vi.fn() },
  runsApi: { get: vi.fn(), cancel: vi.fn() },
}));

// The tool picker and the sidebar are fed by shared stores; neither is what these tests
// are about, and a real one would fetch on mount.
vi.mock("@/lib/api/tools-store", () => ({ useTools: () => [] }));
vi.mock("@/lib/api/conversations-store", () => ({
  PAGE_SIZE: 15,
  useConversations: () => ({
    data: conversationList,
    page: sidebarPage,
    total: sidebarTotal,
    search: sidebarSearch,
    loading: false,
    error: null,
  }),
  conversationsStore: {
    reload: vi.fn(),
    setPage: (...args: unknown[]) => setPage(...args),
    setSearch: (...args: unknown[]) => setSearch(...args),
  },
}));

const setPage = vi.fn();
const setSearch = vi.fn();

let sidebarPage = 0;
let sidebarTotal = 0;
let sidebarSearch = "";

let conversationList: ConversationPayload[] = [];

function turn(overrides: Partial<ConversationTurnPayload> = {}): ConversationTurnPayload {
  return {
    id: 1,
    prompt: "en cok hesabi olan 3 domaini ver",
    pinnedTool: null,
    toolName: "bireysel_local_yaanidb",
    executed: true,
    status: "planned",
    reasoning: "matched on the table name",
    problem: null,
    statement: "SELECT domain, count(*) FROM tblAccounts GROUP BY domain",
    answer: null,
    warnings: null,
    runRef: null,
    failure: null,
    awaitingApproval: false,
    createdAt: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function conversation(
  turns: ConversationTurnPayload[],
  continuing = false,
): ConversationPayload {
  return {
    conversationRef: "conv_abc",
    title: "en cok hesabi olan 3 domaini ver",
    turnCount: turns.length,
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
    continuing,
    turns,
  };
}

/**
 * The console history that closing the page used to erase.
 *
 * The turns lived in React state and nowhere else: leaving the page lost the question, the
 * reasoning and the plan together, and a turn that was not executed left no run either.
 */
describe("ConsoleView history", () => {
  beforeEach(() => {
    vi.mocked(runsApi.get).mockReset();
    setPage.mockReset();
    setSearch.mockReset();
    sidebarPage = 0;
    sidebarTotal = 0;
    sidebarSearch = "";
    vi.mocked(conversationsApi.get).mockReset();
    vi.mocked(conversationsApi.remove).mockReset();
    vi.mocked(toolsApi.prompt).mockReset();
    vi.mocked(toolsApi.approveStep).mockReset();
    vi.mocked(toolsApi.declineStep).mockReset();
    conversationList = [conversation([turn()])];
    window.localStorage.clear();
  });

  it("reopens the conversation that was last open", async () => {
    // What "carry on where I left off" means when the page was closed rather than navigated
    // away from: the reference is remembered here, the conversation itself is on the server.
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");
    vi.mocked(conversationsApi.get).mockResolvedValue(conversation([turn()]));

    render(<ConsoleView />);

    expect(await screen.findByText("en cok hesabi olan 3 domaini ver")).toBeInTheDocument();
    expect(screen.getByText(/SELECT domain/)).toBeInTheDocument();
    expect(conversationsApi.get).toHaveBeenCalledWith("conv_abc");
  });

  it("keeps a turn that was only planned", async () => {
    /*
     * The commonest use of the console, and the one that used to vanish completely: with
     * the box unticked nothing is dispatched, so there is no run to find it under either.
     */
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");
    vi.mocked(conversationsApi.get).mockResolvedValue(
      conversation([turn({ executed: false, runRef: null })]),
    );

    render(<ConsoleView />);

    expect(await screen.findByText(/SELECT domain/)).toBeInTheDocument();
    expect(screen.getByText(/yalnızca plan|plan only/i)).toBeInTheDocument();
  });

  it("offers a step the loop wrote, and does not run it on its own", async () => {
    /*
     * A goal made of shell commands stops at each step: the loop chose the command, nobody
     * typed it, and the machine it lands on is real. What the console shows is the command
     * and a button, not a result.
     */
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");
    vi.mocked(conversationsApi.get).mockResolvedValue(
      conversation([
        turn({
          id: 9,
          prompt: "apache servisini baslat",
          toolName: "rock_linux",
          statement: "systemctl enable --now httpd",
          executed: false,
          runRef: null,
          awaitingApproval: true,
        }),
      ]),
    );

    render(<ConsoleView />);

    expect(await screen.findByText("systemctl enable --now httpd")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /onayla|approve/i })).toBeInTheDocument();
    expect(toolsApi.approveStep).not.toHaveBeenCalled();
  });

  it("can turn a step down as well as approve it", async () => {
    /*
     * A screen that can only say yes is not asking; it is waiting for somebody to give in.
     * The command above is a delete as often as it is a read.
     */
    const user = userEvent.setup();
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");
    vi.mocked(conversationsApi.get).mockResolvedValue(
      conversation([
        turn({
          id: 9,
          statement: "DELETE http://h/api/users/59",
          executed: false,
          runRef: null,
          awaitingApproval: true,
        }),
      ]),
    );
    vi.mocked(toolsApi.declineStep).mockResolvedValue(undefined as never);

    render(<ConsoleView />);
    await user.click(await screen.findByRole("button", { name: /vazgeç|cancel/i }));

    await waitFor(() => expect(toolsApi.declineStep).toHaveBeenCalledWith(9));
    expect(toolsApi.approveStep).not.toHaveBeenCalled();
    expect(await screen.findByText(/reddettiniz|turned this step down/i)).toBeInTheDocument();
  });

  it("approves by turn id, never by sending the command back", async () => {
    /*
     * The command on screen is what the step resolved to when the loop planned it. Posting
     * that string to be run would be the one way into the executor that skipped routing,
     * the planner and the guardrails.
     */
    const user = userEvent.setup();
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");
    vi.mocked(conversationsApi.get).mockResolvedValue(
      conversation([
        turn({
          id: 9,
          statement: "systemctl enable --now httpd",
          executed: false,
          runRef: null,
          awaitingApproval: true,
        }),
      ]),
    );
    vi.mocked(toolsApi.approveStep).mockResolvedValue({
      conversationRef: "conv_abc",
      turnId: 10,
      result: {
        answer: "",
        tool_name: "rock_linux",
        arguments: {},
        reasoning: "",
        problem: null,
        status: "planned",
        plan: null,
        dispatch: null,
      },
    });

    render(<ConsoleView />);
    await user.click(await screen.findByRole("button", { name: /onayla|approve/i }));

    await waitFor(() => expect(toolsApi.approveStep).toHaveBeenCalledWith(9));
    expect(toolsApi.prompt).not.toHaveBeenCalled();
  });

  it("asks the next question into the conversation that is open", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");
    vi.mocked(conversationsApi.get).mockResolvedValue(conversation([turn()]));
    vi.mocked(toolsApi.prompt).mockResolvedValue({
      conversationRef: "conv_abc",
      turnId: 2,
      result: {
        answer: "",
        tool_name: "bireysel_local_yaanidb",
        arguments: {},
        reasoning: "",
        problem: null,
        status: "planned",
        plan: null,
        dispatch: null,
      },
    });

    render(<ConsoleView />);
    await screen.findByText(/SELECT domain/);

    await user.type(screen.getByRole("textbox", { name: /sorunuz|your question/i }), "kac tane hesap var");
    await user.click(screen.getByRole("button", { name: /gönder|send/i }));

    await waitFor(() =>
      expect(toolsApi.prompt).toHaveBeenCalledWith(
        "kac tane hesap var",
        false,
        undefined,
        "conv_abc",
      ),
    );
  });

  it("starts a new conversation without a reference", async () => {
    // The gateway decides which conversation a question goes into. A browser that named
    // one could append to a session it does not own.
    const user = userEvent.setup();
    vi.mocked(toolsApi.prompt).mockResolvedValue({
      conversationRef: "conv_new",
      turnId: 1,
      result: {
        answer: "",
        tool_name: null,
        arguments: {},
        reasoning: "",
        problem: "nothing matched",
        status: null,
        plan: null,
        dispatch: null,
      },
    });

    render(<ConsoleView />);

    await user.type(screen.getByRole("textbox", { name: /sorunuz|your question/i }), "merhaba");
    await user.click(screen.getByRole("button", { name: /gönder|send/i }));

    await waitFor(() =>
      expect(toolsApi.prompt).toHaveBeenCalledWith("merhaba", false, undefined, undefined),
    );
    expect(window.localStorage.getItem("mcp-panel.console.conversation")).toBe("conv_new");
  });

  it("does not point at a conversation that is gone", async () => {
    // Deleted in another tab, or never this caller's. Either way the next question must
    // not be appended to something that does not exist.
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_gone");
    vi.mocked(conversationsApi.get).mockRejectedValue(new Error("Not found"));

    render(<ConsoleView />);

    await waitFor(() =>
      expect(window.localStorage.getItem("mcp-panel.console.conversation")).toBeNull(),
    );
    expect(await screen.findByText(/henüz bir şey sormadın|nothing asked yet/i)).toBeInTheDocument();
  });

  it("looks for what was typed, once the typing stops", async () => {
    /*
     * Bound straight to the store, every keystroke would be a request. Bound only to
     * local state, the box would clear itself on the reload that follows every question.
     */
    const user = userEvent.setup();
    render(<ConsoleView />);

    await user.type(
      screen.getByRole("textbox", { name: /oturumlarda ara|search sessions/i }),
      "tblAccounts",
    );

    await waitFor(() => expect(setSearch).toHaveBeenCalledWith("tblAccounts"));

    // Once for the whole word, not once per letter.
    expect(setSearch).toHaveBeenCalledTimes(1);
  });

  it("offers no pager when everything fits on one page", async () => {
    // A pager under three rows is furniture.
    conversationList = [conversation([turn()])];
    sidebarTotal = 1;

    render(<ConsoleView />);

    expect(
      screen.queryByRole("button", { name: /sonraki sayfa|next page/i }),
    ).not.toBeInTheDocument();
  });

  it("pages through the sessions", async () => {
    const user = userEvent.setup();
    conversationList = [conversation([turn()])];
    sidebarTotal = 40;

    render(<ConsoleView />);

    await user.click(screen.getByRole("button", { name: /sonraki sayfa|next page/i }));

    expect(setPage).toHaveBeenCalledWith(1);

    // Nothing to go back to from the first page. Checked by the attribute rather than
    // toBeDisabled(): CoreUI draws a pagination item as an anchor, and an anchor is never
    // "disabled" in the sense that matcher means.
    expect(
      screen.getByRole("button", { name: /önceki sayfa|previous page/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("goes to a page by its number", async () => {
    // Three pages of fifteen. Reaching the third should not be three clicks of "next".
    const user = userEvent.setup();
    conversationList = [conversation([turn()])];
    sidebarTotal = 40;

    render(<ConsoleView />);

    await user.click(screen.getByRole("button", { name: /sayfa 3|page 3/i }));

    expect(setPage).toHaveBeenCalledWith(2);
  });

  it("marks the page being shown, and does not offer it as a link", async () => {
    /*
     * CoreUI draws the active item as a plain span inside a list item carrying
     * aria-current, rather than as another anchor — which is right: you are already
     * there, and a link to where you are is a link that does nothing.
     */
    conversationList = [conversation([turn()])];
    sidebarTotal = 40;
    sidebarPage = 1;

    render(<ConsoleView />);

    const pager = screen.getByLabelText(/oturum sayfaları|session pages/i);
    const here = pager.querySelector('[aria-current="page"]');

    expect(here).not.toBeNull();
    expect(here).toHaveTextContent("2");

    // The others still are links; only this one is not.
    expect(screen.getByRole("button", { name: /sayfa 1|page 1/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sayfa 2|page 2/i }),
    ).not.toBeInTheDocument();
  });

  it("asks before deleting a conversation, and names which one", async () => {
    /*
     * `window.confirm` blocked the page on a dialog styled by the operating system, with
     * no room to say which conversation was going: it asked "delete this conversation?"
     * over a sidebar of twenty, and which one was "this" was whichever row the pointer had
     * happened to be over.
     */
    const user = userEvent.setup();
    conversationList = [conversation([turn()])];
    vi.mocked(conversationsApi.get).mockResolvedValue(conversation([turn()]));

    render(<ConsoleView />);

    await user.click(await screen.findByLabelText(/sohbeti sil|delete this conversation/i));

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("en cok hesabi olan 3 domaini ver")).toBeInTheDocument();
    expect(conversationsApi.remove).not.toHaveBeenCalled();
  });

  it("deletes only once the person says so", async () => {
    const user = userEvent.setup();
    conversationList = [conversation([turn()])];
    vi.mocked(conversationsApi.get).mockResolvedValue(conversation([turn()]));
    vi.mocked(conversationsApi.remove).mockResolvedValue(undefined as never);

    render(<ConsoleView />);
    await user.click(await screen.findByLabelText(/sohbeti sil|delete this conversation/i));

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /sohbeti sil|delete this conversation/i }),
    );

    await waitFor(() => expect(conversationsApi.remove).toHaveBeenCalledWith("conv_abc"));
  });

  it("leaves the conversation alone when the answer is no", async () => {
    // The half a confirmation exists for. A dialog whose only button is "yes" is not asking.
    const user = userEvent.setup();
    conversationList = [conversation([turn()])];
    vi.mocked(conversationsApi.get).mockResolvedValue(conversation([turn()]));

    render(<ConsoleView />);
    await user.click(await screen.findByLabelText(/sohbeti sil|delete this conversation/i));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /vazge\u00e7|cancel/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(conversationsApi.remove).not.toHaveBeenCalled();
  });

  it("says so while the loop is still deciding", async () => {
    /*
     * The gap was silent. Deciding the next step is a model call — eleven seconds on a
     * real goal — and the console showed nothing at all for it, then produced an approval
     * card out of a clear sky. What was missing was not the card but the wait before it.
     *
     * Real timers, for the same reason as the test below: findBy* polls on its own clock.
     */
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");

    const ran = turn({ id: 1, executed: true, runRef: "run-1" });

    vi.mocked(conversationsApi.get).mockResolvedValue(conversation([ran], true));
    vi.mocked(runsApi.get).mockResolvedValue({
      id: 1, runRef: "run-1", actionRef: "a", definitionId: 1, toolName: "t",
      actionName: "a", actorLabel: "me", purpose: "execute", status: "succeeded",
      error: null, statement: "GET http://h/api/users",
      startedAt: "2026-09-08T10:00:00Z", finishedAt: "2026-09-08T10:00:01Z",
      targets: [],
    } as never);

    render(<ConsoleView />);

    expect(
      await screen.findByText(/hazırlanıyor|next step/i, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
  }, 12_000);

  it("says nothing once the loop has settled", async () => {
    // The loop is consulted after every executed run, so the line does appear briefly for
    // an ordinary question too — that is honest, it is deciding. What must not happen is
    // the line outliving the decision.
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");

    const ran = turn({ id: 1, executed: true, runRef: "run-1" });

    vi.mocked(conversationsApi.get).mockResolvedValue(conversation([ran], false));
    vi.mocked(runsApi.get).mockResolvedValue({
      id: 1, runRef: "run-1", actionRef: "a", definitionId: 1, toolName: "t",
      actionName: "a", actorLabel: "me", purpose: "execute", status: "succeeded",
      error: null, statement: "GET http://h/api/users",
      startedAt: "2026-09-08T10:00:00Z", finishedAt: "2026-09-08T10:00:01Z",
      targets: [],
    } as never);

    render(<ConsoleView />);
    await screen.findByText(/SELECT domain/);

    await new Promise((resume) => setTimeout(resume, 1500));

    expect(screen.queryByText(/hazırlanıyor|next step/i)).not.toBeInTheDocument();
  }, 12_000);

  it("keeps looking for a step the loop is still deciding on", async () => {
    /*
     * A finished run is when the loop *starts* deciding, and deciding is a model call: on
     * a real goal the delete step appeared eleven seconds after the search returned. The
     * console asked once, at the instant the run finished, found nothing and never looked
     * again — so the approval card never appeared and the goal looked like it had stopped
     * after one step.
     *
     * Real timers on purpose: findBy* polls on its own clock, and a fake one here leaks
     * into every test after it.
     */
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");

    const ran = turn({ id: 1, executed: true, runRef: "run-1" });
    const proposed = turn({
      id: 2,
      prompt: "57 numarali kullaniciyi sil",
      statement: "DELETE http://h/api/users/57",
      executed: false,
      runRef: null,
      awaitingApproval: true,
    });

    // Not there when the run ends; there by the time it is asked again.
    vi.mocked(conversationsApi.get)
      .mockResolvedValueOnce(conversation([ran]))
      .mockResolvedValue(conversation([ran, proposed]));

    vi.mocked(runsApi.get).mockResolvedValue({
      id: 1, runRef: "run-1", actionRef: "a", definitionId: 1, toolName: "t",
      actionName: "a", actorLabel: "me", purpose: "execute", status: "succeeded",
      error: null, statement: "GET http://h/api/users",
      startedAt: "2026-09-08T10:00:00Z", finishedAt: "2026-09-08T10:00:01Z",
      targets: [],
    } as never);

    render(<ConsoleView />);

    expect(
      await screen.findByText("DELETE http://h/api/users/57", {}, { timeout: 8000 }),
    ).toBeInTheDocument();
  }, 12_000);

  it("says a search matched nothing, rather than looking empty", async () => {
    /*
     * "No sessions yet" under a search box with words in it reads as the history having
     * been lost. They are two different facts and the screen has to carry the difference.
     */
    conversationList = [];
    sidebarSearch = "tblAccounts";

    render(<ConsoleView />);

    expect(
      await screen.findByText(/bunu geçen bir oturum yok|no session mentions/i),
    ).toBeInTheDocument();
  });
});

/**
 * Not everything typed into a console is a request to run something.
 *
 * "What did I just run?", "why did that come back empty", "explain that query" are all
 * answerable from the conversation, and replying "no published tool matches this request"
 * to them made the console useless for the questions people actually ask in one.
 */
describe("an answer with no tool behind it", () => {
  beforeEach(() => {
    vi.mocked(conversationsApi.get).mockReset();
    vi.mocked(toolsApi.prompt).mockReset();
    conversationList = [];
    window.localStorage.clear();
  });

  it("shows what the model said", async () => {
    const user = userEvent.setup();
    vi.mocked(toolsApi.prompt).mockResolvedValue({
      conversationRef: "conv_1",
      turnId: 1,
      result: {
        answer: "Az önce SELECT COUNT(*) FROM tblAccounts sorgusunu çalıştırdın.",
        tool_name: null,
        arguments: {},
        reasoning: "",
        problem: "No published tool matches this request",
        status: null,
        plan: null,
        dispatch: null,
      },
    });

    render(<ConsoleView />);
    await user.type(screen.getByRole("textbox", { name: /sorunuz|your question/i }), "az once ne calistirdim?");
    await user.click(screen.getByRole("button", { name: /gönder|send/i }));

    expect(await screen.findByText(/SELECT COUNT/)).toBeInTheDocument();
  });

  it("says that nothing was run", async () => {
    // A sentence about how many accounts exist reads exactly like a count of them. The
    // difference is the difference between a fact and a guess, so the screen has to carry
    // it — the words will not.
    const user = userEvent.setup();
    vi.mocked(toolsApi.prompt).mockResolvedValue({
      conversationRef: "conv_1",
      turnId: 1,
      result: {
        answer: "Yaklaşık 500 civarı olabilir.",
        tool_name: null,
        arguments: {},
        reasoning: "",
        problem: "No published tool matches this request",
        status: null,
        plan: null,
        dispatch: null,
      },
    });

    render(<ConsoleView />);
    await user.type(screen.getByRole("textbox", { name: /sorunuz|your question/i }), "kac hesap vardi?");
    await user.click(screen.getByRole("button", { name: /gönder|send/i }));

    expect(
      await screen.findByText(/nothing was run|hiçbir şey çalıştırılmadı/i),
    ).toBeInTheDocument();
  });

  it("keeps a narrowing warning with the turn it belongs to", async () => {
    /*
     * The warning is worth more later than at the time. Whether a number counted
     * everything is not what the person watching it appear asks; it is what somebody asks
     * a week afterwards, by which point the live warning had scrolled away.
     */
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");
    vi.mocked(conversationsApi.get).mockResolvedValue(
      conversation([
        turn({
          warnings: [{ code: "unrequested_filter", detail: "domain = 'bireysel'" }],
        }),
      ]),
    );

    render(<ConsoleView />);

    expect(await screen.findByText(/domain = 'bireysel'/)).toBeInTheDocument();
  });

  it("keeps it when the conversation is reopened", async () => {
    window.localStorage.setItem("mcp-panel.console.conversation", "conv_abc");
    vi.mocked(conversationsApi.get).mockResolvedValue(
      conversation([
        turn({
          toolName: null,
          statement: null,
          runRef: null,
          answer: "Az önce hesap sayısını sorguladın.",
        }),
      ]),
    );

    render(<ConsoleView />);

    expect(await screen.findByText(/hesap sayısını sorguladın/)).toBeInTheDocument();
  });
});
