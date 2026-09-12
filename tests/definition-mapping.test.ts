import { describe, expect, it } from "vitest";

import { fromDefinition, toDefinition } from "@/lib/api/mappers";
import { createAction, type Definition, type RestAction } from "@/lib/definitions";

function definition(action: RestAction): Definition {
  return {
    id: 1,
    name: "Kaynaklar",
    toolName: "kaynaklar",
    toolDescription: "",
    modelId: 11,
    systemPrompt: "",
    actions: [action],
    inputs: [],
    enabled: true,
    updatedAt: "2026-09-07T00:00:00Z",
  };
}

function rest(overrides: Partial<RestAction> = {}): RestAction {
  return { ...(createAction("rest") as RestAction), ...overrides };
}

/**
 * What the editor sends when a definition is saved.
 *
 * The gateway is the only writer and therefore the only authority; these are the shapes
 * it refuses, dropped here so a form that cannot express the correction can still be
 * saved.
 */
describe("fromDefinition", () => {
  it("drops the body of a GET request", () => {
    /*
     * A new REST action starts as POST with a body. Switching it to GET greys the field
     * out — so a definition already holding one has no way to clear it by hand, and the
     * gateway refuses every save with "A GET request cannot carry a body".
     */
    const body = fromDefinition(
      definition(rest({ method: "GET", body: '{"stale": true}' })),
    );

    expect(body.actions[0].config).toMatchObject({ method: "GET", body: "" });
  });

  it("keeps the body of every other method", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const body = fromDefinition(definition(rest({ method, body: '{"a":1}' })));

      expect(body.actions[0].config).toMatchObject({ method, body: '{"a":1}' });
    }
  });

  it("leaves an SSH action's own fields alone", () => {
    // The rule is about REST. An SSH action has no method and no body to confuse it with.
    const ssh = createAction("ssh");
    const body = fromDefinition({ ...definition(rest()), actions: [ssh] });

    expect(body.actions[0].kind).toBe("ssh");
    expect(body.actions[0].config).not.toHaveProperty("body");
  });

  it("gives every stored header an id of its own", () => {
    /*
     * Headers come back as {key, value} and the editor keys its rows by id. Spreading the
     * stored config over a blank action replaced the ids with nothing, so every row
     * rendered with an undefined key — and rows lose their identity when one is removed.
     */
    const definition = toDefinition({
      id: 1, name: "K", toolName: "k", toolDescription: "", modelId: 11,
      modelName: null, modelIdentifier: null, modelProvider: null, modelEndpoint: null,
      modelParams: null, systemPrompt: "", enabled: true, inputs: [],
      updatedAt: "2026-09-08T00:00:00Z", createdAt: "2026-09-08T00:00:00Z",
      actions: [{
        id: 1, kind: "rest", name: "a", description: "", position: 0,
        hostGroupId: null, hostGroupName: null, resolvedTargetCount: 0, hosts: [],
        config: {
          method: "GET", url: "http://h",
          headers: [
            { key: "Accept", value: "application/json" },
            { key: "X-Trace", value: "1" },
          ],
        },
      }],
    } as never);

    const headers = (definition.actions[0] as RestAction).headers;
    const ids = headers.map((header) => header.id);

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(headers.length);
    expect(headers.map((header) => header.key)).toEqual(["Accept", "X-Trace"]);
  });

  it("never sends a credential inside the config document", () => {
    // The config is stored as JSON; a plaintext key placed there would be a plaintext key
    // in the database.
    const body = fromDefinition(definition(rest()));

    for (const key of ["privateKey", "passphrase", "password"]) {
      expect(body.actions[0].config).not.toHaveProperty(key);
    }
  });
});
