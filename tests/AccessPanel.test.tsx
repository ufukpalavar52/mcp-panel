import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccessPanel from "@/components/definitions/AccessPanel";
import { definitionAccessApi, usersApi } from "@/lib/api/endpoints";
import type { DefinitionAccessPayload } from "@/lib/api/types";

vi.mock("@/lib/api/endpoints", () => ({
  definitionAccessApi: { get: vi.fn(), replace: vi.fn() },
  usersApi: { list: vi.fn() },
}));

function person(id: number, email: string) {
  return {
    id,
    email,
    fullName: email.split("@")[0],
    role: "developer" as const,
    status: "active" as const,
    team: null,
    avatarUrl: null,
    lastLoginAt: null,
    createdAt: "2026-09-01T00:00:00Z",
  };
}

function open(): DefinitionAccessPayload {
  return { access: "OPEN", permissions: [] };
}

beforeEach(() => {
  vi.mocked(usersApi.list).mockResolvedValue({
    content: [person(1, "ayse@example.com"), person(2, "mehmet@example.com")],
    page: 0,
    size: 100,
    totalElements: 2,
    totalPages: 1,
    last: true,
  });
  vi.mocked(definitionAccessApi.replace).mockImplementation(
    async (_id, body) => body as DefinitionAccessPayload,
  );
});

/**
 * Who may reach a definition.
 *
 * Until this screen existed, authorisation was the role alone: anybody with DEVELOPER could
 * run every published tool, including one carrying `allowedCommands: ["*"]` and sudo.
 */
describe("AccessPanel", () => {
  it("shows no list at all while the definition is open to everybody", async () => {
    vi.mocked(definitionAccessApi.get).mockResolvedValue(open());

    render(<AccessPanel definitionId={1} />);
    await screen.findByText(/access|erişim/i);

    expect(screen.queryByText("ayse@example.com")).toBeNull();
  });

  it("warns when a definition is restricted and nobody is on the list", async () => {
    /*
     * The state people arrive at by accident and then cannot explain. It is deliberately
     * *not* treated as "open to everybody": a permission that can be lost by deleting the
     * last row is not one anybody can reason about.
     */
    vi.mocked(definitionAccessApi.get).mockResolvedValue({
      access: "RESTRICTED",
      permissions: [],
    });

    render(<AccessPanel definitionId={1} />);

    expect(
      await screen.findByText(/nobody but an administrator|yöneticiler dışında kimse/i),
    ).toBeInTheDocument();
  });

  it("ticks run when edit is ticked", async () => {
    /*
     * Edit carries run with it on the server, and the boxes say so rather than leaving
     * somebody to discover it — otherwise the screen shows a state ("may edit, may not
     * run") that is never honoured.
     */
    const user = userEvent.setup();
    vi.mocked(definitionAccessApi.get).mockResolvedValue({
      access: "RESTRICTED",
      permissions: [],
    });

    render(<AccessPanel definitionId={1} />);
    await screen.findByText("ayse@example.com");

    await user.click(screen.getByLabelText(/May edit — ayse@example.com|Düzenleyebilir — ayse@example.com/));

    expect(
      screen.getByLabelText(/May run — ayse@example.com|Çalıştırabilir — ayse@example.com/),
    ).toBeChecked();
  });

  it("clears edit when run is taken away", async () => {
    const user = userEvent.setup();
    vi.mocked(definitionAccessApi.get).mockResolvedValue({
      access: "RESTRICTED",
      permissions: [{ userId: 1, canRun: true, canEdit: true }],
    });

    render(<AccessPanel definitionId={1} />);
    await screen.findByText("ayse@example.com");

    await user.click(screen.getByLabelText(/May run — ayse@example.com|Çalıştırabilir — ayse@example.com/));

    expect(
      screen.getByLabelText(/May edit — ayse@example.com|Düzenleyebilir — ayse@example.com/),
    ).not.toBeChecked();
  });

  it("sends only the people who were granted something", async () => {
    /*
     * A row granting nothing is not a restriction, it is a line nobody can read. Taking
     * somebody's access away means taking them off the list.
     */
    const user = userEvent.setup();
    vi.mocked(definitionAccessApi.get).mockResolvedValue({
      access: "RESTRICTED",
      permissions: [{ userId: 1, canRun: true, canEdit: false }],
    });

    render(<AccessPanel definitionId={1} />);
    await screen.findByText("ayse@example.com");

    await user.click(screen.getByLabelText(/May run — ayse@example.com|Çalıştırabilir — ayse@example.com/));
    await user.click(screen.getByRole("button", { name: /save|kaydet/i }));

    await waitFor(() => expect(definitionAccessApi.replace).toHaveBeenCalled());
    expect(vi.mocked(definitionAccessApi.replace).mock.calls[0][1].permissions).toEqual([]);
  });
});
