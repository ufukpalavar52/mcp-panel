import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ToolRunModal from "@/components/tools/ToolRunModal";
import type { ToolPayload } from "@/lib/api/types";

vi.mock("@/lib/api/endpoints", () => ({
  toolsApi: { execute: vi.fn() },
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
});
