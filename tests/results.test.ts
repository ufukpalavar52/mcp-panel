import { describe, expect, it } from "vitest";

import { asText, successfulText } from "@/lib/results";
import type { RunPayload } from "@/lib/api/types";

type Target = RunPayload["targets"][number];

function target(overrides: Partial<Target> = {}): Target {
  return {
    address: "127.0.0.1",
    status: "succeeded",
    exitCode: 0,
    durationMs: 4,
    stdoutExcerpt: null,
    stderrExcerpt: null,
    rows: null,
    ...overrides,
  } as Target;
}

/**
 * What the copy button puts on the clipboard.
 *
 * Rows go as tab separated text because that is what a spreadsheet reads when it is
 * pasted into; commas would need quoting rules and would arrive as one column in half the
 * tools people actually use.
 */
describe("copying a result", () => {
  it("writes rows as a table a spreadsheet will accept", () => {
    const copied = asText(
      target({
        rows: [
          { id: 1, name: "ali" },
          { id: 2, name: "veli" },
        ],
      }),
    );

    expect(copied).toBe("id\tname\n1\tali\n2\tveli");
  });

  it("keeps a command's output exactly as it printed", () => {
    // The point of copying a log is to have the log.
    const copied = asText(target({ stdoutExcerpt: " 10:36  up 1 day\n  load: 0.4\n" }));

    expect(copied).toBe(" 10:36  up 1 day\n  load: 0.4\n");
  });

  it("writes an empty cell for a missing value rather than the word NULL", () => {
    // The table says NULL so a reader can tell it apart from an empty string. A
    // spreadsheet cell should be empty, because that is what it means there.
    const copied = asText(target({ rows: [{ id: 1, name: null }] }));

    expect(copied).toBe("id\tname\n1\t");
  });

  it("flattens a nested value rather than printing [object Object]", () => {
    const copied = asText(target({ rows: [{ id: 1, meta: { a: 1 } }] }));

    expect(copied).toBe('id\tmeta\n1\t{"a":1}');
  });

  it("leaves out what failed", () => {
    /*
     * A failed target's output is an error and half an answer. Pasting it into a report
     * beside the real rows is how a number nobody can reproduce ends up in a slide.
     */
    const copied = successfulText([
      target({ address: "a", rows: [{ id: 1 }] }),
      target({ address: "b", status: "failed", stdoutExcerpt: "boom" }),
    ]);

    expect(copied).toBe("id\n1");
  });

  it("labels each host only when there is more than one", () => {
    const one = successfulText([target({ address: "a", stdoutExcerpt: "up" })]);
    const two = successfulText([
      target({ address: "a", stdoutExcerpt: "up" }),
      target({ address: "b", stdoutExcerpt: "up too" }),
    ]);

    expect(one).toBe("up");
    expect(two).toBe("# a\nup\n\n# b\nup too");
  });

  it("has nothing to copy when nothing succeeded", () => {
    // The button hides itself rather than copying an empty string, which looks broken in
    // exactly the way a button that does nothing does.
    expect(successfulText([target({ status: "failed", stdoutExcerpt: "boom" })])).toBe("");
    expect(successfulText([])).toBe("");
  });
});
