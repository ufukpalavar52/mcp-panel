import { describe, expect, it } from "vitest";

import { createInput, toolInputSchema, type DynamicInput } from "@/lib/definitions";

function input(overrides: Partial<DynamicInput> = {}): DynamicInput {
  return { ...createInput(), key: "value", ...overrides };
}

/**
 * The schema is the only thing the run screen sees.
 *
 * It generates its form from the tool's JSON Schema rather than from the definition,
 * because the schema is exactly what an MCP client gets — so anything the schema does not
 * carry is something no caller, the panel included, can act on.
 */
describe("toolInputSchema", () => {
  it("marks a block as wanting a box rather than a line", () => {
    /*
     * Both of these used to fall through to a plain string, and the run screen drew each
     * of them as a one-line field. A script cannot be pasted into a one-line field, which
     * made a definition built around a heredoc impossible to call from the panel that
     * created it.
     */
    const schema = toolInputSchema([input({ key: "content", type: "block" })]);

    expect(schema.properties.content).toEqual({ type: "string", format: "textarea" });
  });

  it("marks a textarea the same way", () => {
    const schema = toolInputSchema([input({ key: "notes", type: "textarea" })]);

    expect(schema.properties.notes).toEqual({ type: "string", format: "textarea" });
  });

  it("leaves plain text a line", () => {
    const schema = toolInputSchema([input({ key: "path", type: "text" })]);

    expect(schema.properties.path.format).toBeUndefined();
  });

  it("still carries the label and whether it is required", () => {
    /*
     * The new branch sits in the same switch as `password` and `date`, and a `break` in
     * the wrong place would take the rest of the field with it.
     */
    const schema = toolInputSchema([
      input({ key: "content", type: "block", label: "File contents", required: true }),
    ]);

    expect(schema.properties.content.description).toBe("File contents");
    expect(schema.required).toEqual(["content"]);
  });
});
