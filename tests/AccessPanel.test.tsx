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

/**
 * A grant as the gateway returns one: the address and name come back with it, so a person
 * already granted can be listed without being in the search results.
 */
function granted(userId: number, flags: { canRun: boolean; canEdit: boolean }) {
  return {
    userId,
    email: userId === 1 ? "ayse@example.com" : "mehmet@example.com",
    fullName: userId === 1 ? "ayse" : "mehmet",
    ...flags,
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
      permissions: [granted(1, { canRun: true, canEdit: true })],
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
      permissions: [granted(1, { canRun: true, canEdit: false })],
    });

    render(<AccessPanel definitionId={1} />);
    await screen.findByText("ayse@example.com");

    await user.click(screen.getByLabelText(/May run — ayse@example.com|Çalıştırabilir — ayse@example.com/));
    await user.click(screen.getByRole("button", { name: /save|kaydet/i }));

    await waitFor(() => expect(definitionAccessApi.replace).toHaveBeenCalled());
    expect(vi.mocked(definitionAccessApi.replace).mock.calls[0][1].permissions).toEqual([]);
  });
});

/**
 * Choosing among many people.
 *
 * The list used to draw everybody the first page happened to contain. That is fine with
 * four accounts and useless with four hundred — the screen exists to find the two or three
 * who should reach a definition, not to scroll past the rest.
 */
describe("AccessPanel with many people", () => {
  it("asks the server for ten, rather than filtering a page it already truncated", async () => {
    vi.mocked(definitionAccessApi.get).mockResolvedValue({
      access: "RESTRICTED",
      permissions: [],
    });

    render(<AccessPanel definitionId={1} />);
    await waitFor(() => expect(usersApi.list).toHaveBeenCalled());

    expect(vi.mocked(usersApi.list).mock.calls[0].slice(0, 2)).toEqual([0, 10]);
  });

  it("searches on the server", async () => {
    const user = userEvent.setup();
    vi.mocked(definitionAccessApi.get).mockResolvedValue({
      access: "RESTRICTED",
      permissions: [],
    });

    render(<AccessPanel definitionId={1} />);
    await screen.findByText("ayse@example.com");

    await user.type(screen.getByLabelText(/search people|kullanıcı ara/i), "meh");

    await waitFor(() =>
      expect(vi.mocked(usersApi.list).mock.calls.at(-1)?.[2]).toBe("meh"),
    );
  });

  it("keeps somebody already granted in the list whatever the search returns", async () => {
    /*
     * Hiding a granted person behind a search would leave an access nobody can see and
     * therefore nobody can take away — the list would be editing a state it was not
     * showing.
     */
    vi.mocked(definitionAccessApi.get).mockResolvedValue({
      access: "RESTRICTED",
      permissions: [granted(1, { canRun: true, canEdit: false })],
    });
    vi.mocked(usersApi.list).mockResolvedValue({
      content: [person(2, "mehmet@example.com")],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
      last: true,
    });

    render(<AccessPanel definitionId={1} />);

    expect(await screen.findByText("mehmet@example.com")).toBeInTheDocument();
    expect(screen.getByText("ayse@example.com")).toBeInTheDocument();
  });

  it("says how many more there are rather than just stopping", async () => {
    vi.mocked(definitionAccessApi.get).mockResolvedValue({
      access: "RESTRICTED",
      permissions: [],
    });
    vi.mocked(usersApi.list).mockResolvedValue({
      content: [person(1, "ayse@example.com")],
      page: 0,
      size: 10,
      totalElements: 47,
      totalPages: 5,
      last: false,
    });

    render(<AccessPanel definitionId={1} />);

    expect(await screen.findByText(/46 more|46 kullanıcı daha/)).toBeInTheDocument();
  });
});

