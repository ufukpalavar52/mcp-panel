import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DefinitionForm from "@/components/definitions/DefinitionForm";
import { createDefinition } from "@/lib/definitions";
import { setLocale } from "@/lib/i18n";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/definitions-store", () => ({
  useDefinitionActions: () => ({ save: vi.fn() }),
}));
vi.mock("@/lib/host-groups-store", () => ({
  useHostGroups: () => [{ id: 1, name: "web", hosts: ["web-01", "web-02"] }],
}));
vi.mock("@/lib/models-store", () => ({
  useModels: () => [{ id: 1, name: "Opus", modelId: "claude-opus-5" }],
}));

/** The letters that only Turkish has. Anything English cannot contain one. */
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

function turkishIn(element: HTMLElement): string[] {
  return (element.textContent ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => TURKISH.test(line));
}

/**
 * Every screen at once, cheaply.
 *
 * Rendering each view would mean mocking each view's stores; this asserts the same thing
 * one level down. Together with there being no Turkish string literals outside the
 * dictionaries, it says the English panel has no Turkish in it that did not come from the
 * server.
 */
describe("the English dictionary", () => {
  it("has no Turkish in it", async () => {
    const { en } = await import("@/lib/i18n/en");

    const turkish = Object.entries(en).filter(([, value]) => TURKISH.test(value));

    expect(turkish).toEqual([]);
  });

  it("answers every key the Turkish one does", async () => {
    // The type already enforces this; asserted anyway because a `as` somewhere would make
    // the type stop enforcing it, and the failure would be a blank label on a screen.
    const { en } = await import("@/lib/i18n/en");
    const { tr } = await import("@/lib/i18n/tr");

    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });
});

/**
 * The panel is bilingual, and pieces of it were bypassing the dictionary: a "Vazgeç" button
 * under an English form, and a preview box built entirely from Turkish string literals.
 *
 * Checked by rendering rather than by reading the source, because the defect was never in
 * one place — it was every place that had quietly been written in one language.
 */
describe("the definition form in English", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale("en");
  });

  it("says nothing in Turkish", async () => {
    const { container } = render(
      <DefinitionForm initial={createDefinition()} mode="create" />,
    );

    await waitFor(() =>
      expect(screen.getAllByText(/Cancel/).length).toBeGreaterThan(0),
    );
    expect(turkishIn(container)).toEqual([]);
  });

  it("says nothing in Turkish once an action of each kind is added", async () => {
    // The preview is drawn per action, and it was the largest block of hardcoded text.
    const user = userEvent.setup();
    const { container } = render(
      <DefinitionForm initial={createDefinition()} mode="create" />,
    );

    await user.click(screen.getByRole("button", { name: /add action/i }));
    for (const name of [/REST request/i, /SSH command/i, /Database query/i]) {
      await user.click(screen.getByRole("button", { name }));
    }

    // Proof the click landed: three previews, one per action. Without this the loop could
    // find nothing and the assertion below would be about an empty form.
    expect(container.querySelectorAll("pre").length).toBe(3);
    expect(turkishIn(container)).toEqual([]);
  });

  it("still speaks Turkish when Turkish is chosen", async () => {
    // The point is a dictionary, not an absence of Turkish.
    setLocale("tr");
    const { container } = render(
      <DefinitionForm initial={createDefinition()} mode="create" />,
    );

    await waitFor(() =>
      expect(screen.getAllByText(/Vazgeç/).length).toBeGreaterThan(0),
    );
    expect(turkishIn(container).length).toBeGreaterThan(0);
  });
});
