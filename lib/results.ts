import type { RunPayload } from "@/lib/api/types";

type Target = RunPayload["targets"][number];

/** How a cell reads outside a table: the same rule the table itself uses. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * One target's answer as text somebody can paste somewhere.
 *
 * Rows become tab separated with a header line, because that is what a spreadsheet reads
 * when it is pasted into: commas would need quoting rules and would arrive as one column
 * in half the tools people actually use.
 *
 * A target that only printed is copied as it printed. Nothing is reformatted — the point
 * of copying a log is to have the log.
 */
export function asText(target: Target): string {
  if (target.rows && target.rows.length > 0) {
    const columns = Object.keys(target.rows[0]);

    return [
      columns.join("\t"),
      ...target.rows.map((row) => columns.map((column) => cell(row[column])).join("\t")),
    ].join("\n");
  }

  return target.stdoutExcerpt ?? "";
}

/**
 * Everything a run has to show, ready to paste.
 *
 * Only what succeeded. A failed target's output is an error message and a half-written
 * answer; pasting it into a report beside the real rows is how a number nobody can
 * reproduce ends up in a slide.
 *
 * Addresses are written above each block only when there are several. One host needs no
 * label, and a label there would be a line to delete every time.
 */
export function successfulText(targets: Target[]): string {
  const succeeded = targets.filter(
    (target) => target.status === "succeeded" && asText(target).length > 0,
  );

  if (succeeded.length === 0) return "";
  if (succeeded.length === 1) return asText(succeeded[0]);

  return succeeded.map((target) => `# ${target.address}\n${asText(target)}`).join("\n\n");
}
