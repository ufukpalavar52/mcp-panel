import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ToolRunModal from "@/components/tools/ToolRunModal";
import type { ToolPayload } from "@/lib/api/types";
import { definitionsApi, runsApi, toolsApi } from "@/lib/api/endpoints";

vi.mock("@/lib/api/endpoints", () => ({
  toolsApi: { execute: vi.fn() },
  definitionsApi: { get: vi.fn() },
  // The outcome panel polls for the run. Never resolving keeps it on its waiting state,
  // which is all these tests need from it.
  runsApi: { get: vi.fn(() => new Promise(() => {})) },
}));

function tool(properties: Record<string, unknown>, required: string[] = []): ToolPayload {
  return {
    name: "rock_linux_file",
    description: "",
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    definitionId: 1,
    modelIdentifier: null,
    actionCount: 1,
    enabled: true,
  };
}

const body = tool({ content: { type: "string", format: "textarea" } });

/** A file the picker can hand over, built the way the browser would. */
function file(name: string, text: string) {
  return new File([text], name, { type: "text/plain" });
}

/**
 * The form is generated from the tool's JSON Schema, so what the schema carries is the
 * whole of what this screen can know. `format: "textarea"` is how a body of text — a
 * file's contents, a script — says it needs a box rather than a line.
 */
describe("ToolRunModal", () => {
  it("draws a box for a field the schema marked as a textarea", () => {
    render(<ToolRunModal tool={body} onClose={() => {}} />);

    expect(screen.getByLabelText("content").tagName).toBe("TEXTAREA");
  });

  it("draws a line for a plain string", () => {
    render(
      <ToolRunModal tool={tool({ path: { type: "string" } })} onClose={() => {}} />,
    );

    expect(screen.getByLabelText("path").tagName).toBe("INPUT");
  });

  it("keeps the newlines of a pasted script", async () => {
    /*
     * The reason the box exists. A one-line field accepts the text but shows one line of
     * it, and a script whose indentation cannot be seen is a script read wrong before it
     * is ever run.
     */
    const user = userEvent.setup();
    render(<ToolRunModal tool={body} onClose={() => {}} />);

    const box = screen.getByLabelText("content");
    await user.type(box, "#!/bin/sh{enter}set -eu{enter}echo hello");

    expect(box).toHaveValue("#!/bin/sh\nset -eu\necho hello");
  });

  it("offers no file button beside a plain string", () => {
    render(
      <ToolRunModal tool={tool({ path: { type: "string" } })} onClose={() => {}} />,
    );

    expect(screen.queryByText("Load from a file")).toBeNull();
  });
});

/**
 * Loading a body out of a file.
 *
 * The file never leaves the browser: what is read becomes the field's value and travels
 * the same way a typed one does, so there is no upload endpoint behind any of this.
 */
describe("ToolRunModal file loading", () => {
  function picker() {
    return document.querySelector('input[type="file"]') as HTMLInputElement;
  }

  it("puts a file's text into the box", async () => {
    const user = userEvent.setup();
    render(<ToolRunModal tool={body} onClose={() => {}} />);

    await user.upload(picker(), file("deploy.sh", "#!/bin/sh\nset -eu\n"));

    expect(screen.getByLabelText("content")).toHaveValue("#!/bin/sh\nset -eu\n");
    expect(screen.getByText(/deploy\.sh/)).toBeInTheDocument();
  });

  it("refuses a file with a NUL byte in it", async () => {
    /*
     * The same test git uses to call a file binary, and the one that matters here: this
     * value ends up inside a quoted heredoc, and a heredoc cannot carry a NUL at all.
     */
    const user = userEvent.setup();
    render(<ToolRunModal tool={body} onClose={() => {}} />);

    await user.upload(picker(), file("a.png", "PNG\u0000binary"));

    expect(screen.getByLabelText("content")).toHaveValue("");
    expect(screen.getByText(/is not a text file/)).toBeInTheDocument();
  });

  it("refuses a file past the size limit", async () => {
    const user = userEvent.setup();
    render(<ToolRunModal tool={body} onClose={() => {}} />);

    await user.upload(picker(), file("big.txt", "x".repeat(256 * 1024 + 1)));

    expect(screen.getByLabelText("content")).toHaveValue("");
    expect(screen.getByText(/is too large/)).toBeInTheDocument();
  });

  it("stops naming the file once the text is edited", async () => {
    /*
     * Typing makes the filename a lie. The text stays; the claim about where it came from
     * does not.
     */
    const user = userEvent.setup();
    render(<ToolRunModal tool={body} onClose={() => {}} />);

    await user.upload(picker(), file("deploy.sh", "set -eu"));
    expect(screen.getByText(/deploy\.sh/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("content"), "x");

    expect(screen.queryByText(/deploy\.sh/)).toBeNull();
    expect(screen.getByLabelText("content")).toHaveValue("set -eux");
  });
  /**
   * Approval, in the screen that asked.
   *
   * The box was rendered here and enforced nowhere — three clicks once ran `tail -f` on a
   * live host with no approver recorded. It is enforced now, and the cost of enforcing it
   * was a trip to the console until this button existed.
   */
  /**
   * Choosing among a tool's actions.
   *
   * Which action a request wants is what a sentence says, and this screen fills in a
   * schema instead. A three-action tool answered "the request said which in no words at
   * all" and planned nothing — after the form was filled in and the button pressed.
   */
  describe("several actions", () => {
    const multi = (): ToolPayload => ({ ...tool({}), actionCount: 3, definitionId: 20 });

    /** What the gateway actually answers with, rather than an empty object. */
    const dispatched = {
      status: "planned",
      plan: { status: "planned", model: "m", problems: [], masked_inputs: [], actions: [] },
      dispatch: { status: "queued", reason: "Published", run_id: null, action_run_ids: {} },
    };

    const listed = {
      actions: [
        { id: 95, name: "Dosyayı yaz" },
        { id: 96, name: "Dosyayı çalıştır" },
      ],
    };

    it("asks which action, and sends the one chosen", async () => {
      vi.mocked(definitionsApi.get).mockResolvedValue(listed as never);
      const asked = vi.mocked(toolsApi.execute);
      asked.mockReset();
      asked.mockResolvedValue(dispatched as never);

      const user = userEvent.setup();
      render(<ToolRunModal tool={multi()} onClose={() => {}} />);

      const picker = await screen.findByLabelText(/aksiyon|action/i);
      await user.selectOptions(picker, "96");
      await user.click(screen.getByRole("button", { name: /aracı çalıştır|run the tool/i }));

      expect(asked.mock.calls[0][3]).toBe(96);
    });

    it("sends nothing about an action a single-action tool does not have", async () => {
      const asked = vi.mocked(toolsApi.execute);
      asked.mockReset();
      asked.mockResolvedValue(dispatched as never);

      const user = userEvent.setup();
      render(<ToolRunModal tool={tool({})} onClose={() => {}} />);

      await user.click(screen.getByRole("button", { name: /aracı çalıştır|run the tool/i }));

      expect(screen.queryByLabelText(/aksiyon|action/i)).toBeNull();
      expect(asked.mock.calls[0][3]).toBeUndefined();
    });
  });

  describe("approval", () => {
    const plan = (resolved: string) => ({
      status: "planned",
      plan: {
        status: "planned",
        model: "m",
        problems: [],
        masked_inputs: [],
        actions: [{
          action_id: 1,
          name: "Logu izle",
          kind: "ssh",
          mode: "dynamic",
          targets: ["rocky"],
          resolved,
          authored_by_model: true,
          rejected_reasons: [],
          requires_approval: true,
          skipped: false,
          skip_reason: "",
        }],
      },
      dispatch: {
        status: "awaiting_approval",
        reason: "This action needs approval before it runs.",
        run_id: null,
        action_run_ids: {},
      },
    });

    it("sends the command that was on the screen back as the approval", async () => {
      const asked = vi.mocked(toolsApi.execute);
      asked.mockReset();
      asked.mockResolvedValue(plan("tail -f /var/log/messages") as never);

      const user = userEvent.setup();
      render(<ToolRunModal tool={tool({})} onClose={() => {}} />);

      await user.click(screen.getByRole("button", { name: /aracı çalıştır|run the tool/i }));

      // The first ask carries no approval: there is nothing to approve until a plan
      // exists, and a command nobody has read is not one anybody has agreed to.
      expect(asked.mock.calls[0][2]).toBeUndefined();

      await user.click(screen.getByRole("button", { name: /onayla|approve/i }));

      // The second carries exactly what was drawn, which is what the MCP server compares
      // against the fresh plan before it dispatches anything.
      expect(asked.mock.calls[1][2]).toEqual(["tail -f /var/log/messages"]);
    });

    it("drops the warning once the command has been approved and run", async () => {
      // requires_approval stays true on the action after it has been dispatched -- it is
      // a property of the action, not a state of this run. Showing the warning on that
      // alone left "This action requires approval" next to a command that had just run,
      // which reads as the approval having failed.
      const asked = vi.mocked(toolsApi.execute);
      asked.mockReset();
      asked.mockResolvedValueOnce(plan("tail -f /var/log/messages") as never);
      asked.mockResolvedValueOnce({
        ...plan("tail -f /var/log/messages"),
        dispatch: { status: "queued", reason: "Published", run_id: "r1", action_run_ids: {} },
      } as never);

      const user = userEvent.setup();
      render(<ToolRunModal tool={tool({})} onClose={() => {}} />);

      await user.click(screen.getByRole("button", { name: /aracı çalıştır|run the tool/i }));
      expect(screen.getByText(/onay gerektiriyor|requires approval/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /onayla|approve/i }));

      expect(screen.queryByText(/onay gerektiriyor|requires approval/i)).toBeNull();
    });

    it("shows the run's outcome once something was dispatched", async () => {
      // The screen used to stop at "published to the executor queue", which is where the
      // interesting part begins: the command ran for two minutes and its output went
      // nowhere anybody could see.
      const asked = vi.mocked(toolsApi.execute);
      asked.mockReset();
      asked.mockResolvedValue({
        ...plan("uptime"),
        dispatch: { status: "queued", reason: "Published", run_id: "r1", action_run_ids: {} },
      } as never);

      const user = userEvent.setup();
      render(<ToolRunModal tool={tool({})} onClose={() => {}} />);

      await user.click(screen.getByRole("button", { name: /aracı çalıştır|run the tool/i }));

      expect(vi.mocked(runsApi.get)).toHaveBeenCalledWith("r1");
    });

    it("offers nothing to approve when nothing is waiting", async () => {
      const asked = vi.mocked(toolsApi.execute);
      asked.mockReset();
      asked.mockResolvedValue({
        ...plan("uptime"),
        dispatch: { status: "queued", reason: "Published", run_id: "r1", action_run_ids: {} },
      } as never);

      const user = userEvent.setup();
      render(<ToolRunModal tool={tool({})} onClose={() => {}} />);

      await user.click(screen.getByRole("button", { name: /aracı çalıştır|run the tool/i }));

      expect(screen.queryByRole("button", { name: /onayla|approve/i })).toBeNull();
    });
  });
});
