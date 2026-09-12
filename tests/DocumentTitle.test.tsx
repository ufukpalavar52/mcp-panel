import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DocumentTitle from "@/components/DocumentTitle";
import { setLocale } from "@/lib/i18n";

let pathname = "/definitions";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

/**
 * The tab used to be rendered on the server, where the chosen language is not known —
 * it lives in the browser. So an English panel drew an English page under a Turkish tab.
 */
describe("the browser tab", () => {
  beforeEach(() => {
    window.localStorage.clear();
    pathname = "/definitions";
  });

  it("names the page in the interface language", async () => {
    setLocale("en");
    render(<DocumentTitle />);

    await waitFor(() => expect(document.title).toMatch(/Definitions/));
  });

  it("follows the language when it changes", async () => {
    setLocale("en");
    render(<DocumentTitle />);
    await waitFor(() => expect(document.title).toMatch(/Definitions/));

    act(() => setLocale("tr"));

    await waitFor(() => expect(document.title).toMatch(/Tanımlar/));
  });

  it("falls back to the application's name on a route the menu does not know", async () => {
    // Sign-in, for one. A title of "undefined" is worse than a plain one.
    pathname = "/nowhere";
    setLocale("en");
    render(<DocumentTitle />);

    await waitFor(() => expect(document.title).toBe("MCP Panel"));
  });
});
