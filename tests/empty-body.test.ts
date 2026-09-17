import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A response that succeeded and said nothing.
 *
 * The client only treated 204 as empty, so an endpoint answering 202 with no body went
 * straight to `json()` and threw "Unexpected end of JSON input" — a parser error standing
 * in for a request that had in fact worked. Asking for a password reset failed on screen
 * while the mail was already on its way.
 */
describe("a success with no body", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  /**
   * The client asks for its runtime config before its first request, through the same
   * fetch. Answering both calls with one response let the config read the body and left
   * nothing for the request that followed — a test failure that looked like a client bug.
   */
  async function callWith(response: Response) {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes("/api/config")
          ? new Response(JSON.stringify({ apiUrl: "http://gateway" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            })
          : response,
      ),
    ));

    const { api } = await import("@/lib/api/client");
    return api.post<void>("/api/v1/auth/password/forgot", { email: "a@b.c" });
  }

  it("accepts a 204", async () => {
    await expect(callWith(new Response(null, { status: 204 }))).resolves.toBeUndefined();
  });

  it("accepts any other success that carries nothing", async () => {
    /* The status is not the test — whether there is a body is. */
    await expect(
      callWith(new Response("", { status: 202, headers: { "content-length": "0" } })),
    ).resolves.toBeUndefined();
  });

  it("accepts a blank body even when Content-Length is missing", async () => {
    /* Some proxies drop the header. A body that is present and empty is still empty. */
    await expect(callWith(new Response("", { status: 200 }))).resolves.toBeUndefined();
  });

  it("still reads a body when there is one", async () => {
    const answer = await callWith(
      new Response(JSON.stringify({ active: 2 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    expect(answer).toEqual({ active: 2 });
  });
});
