import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { highlightCommand, highlightOutput } from "@/lib/ui/shell-highlight";

/** The colour a piece of text was painted, or null when it was left alone. */
function colourOf(text: string, nodes: React.ReactNode) {
  render(<pre>{nodes}</pre>);
  const found = screen.getByText(text, { exact: true });
  return found.tagName === "SPAN" ? found.style.color : null;
}

/**
 * A command is known to be shell, so naming its parts is a fact rather than a guess.
 *
 * What the colour is for: somebody about to approve a command reads the verb first. `cat`
 * and `rm` occupy the same space on a screen and mean very different days.
 */
describe("highlightCommand", () => {
  it("names the verb", () => {
    expect(colourOf("cat", highlightCommand("cat /tmp/x.py"))).toBeTruthy();
  });

  it("keeps sudo with the verb rather than treating it as an argument", () => {
    /* It is not the verb, but nobody reads it as one of the arguments either. */
    expect(colourOf("sudo dnf", highlightCommand("sudo dnf install -y git"))).toBeTruthy();
  });

  it("paints a quoted string before anything inside it is matched", () => {
    /*
     * The ordering is the whole correctness of this. A path inside quotes is text, and a
     * matcher that took paths first would break the quote in half and colour its two
     * halves differently.
     */
    const colour = colourOf("'/etc/passwd'", highlightCommand("echo '/etc/passwd'"));

    expect(colour).toBeTruthy();
    expect(screen.queryByText("/etc/passwd", { exact: true })).toBeNull();
  });

  it("gives flags and paths different colours", () => {
    const nodes = highlightCommand("grep -rn /var/log");
    render(<pre>{nodes}</pre>);

    const flag = screen.getByText("-rn").style.color;
    const path = screen.getByText("/var/log").style.color;

    expect(flag).not.toBe(path);
  });

  it("leaves a plain word alone", () => {
    expect(colourOf("hello", highlightCommand("echo hello"))).toBeNull();
  });
});

/**
 * Output is whatever a program printed, and almost nothing about it is knowable.
 *
 * So only the things that are. Anything more would be inventing meaning and painting it
 * on — a colour that says something the text does not.
 */
describe("highlightOutput", () => {
  it("picks out numbers, which is most of what a result is", () => {
    expect(colourOf("42", highlightOutput("count: 42"))).toBeTruthy();
  });

  it("picks out a line that reports trouble", () => {
    const line = "Traceback (most recent call last):";
    expect(colourOf(line, highlightOutput(line))).toBeTruthy();
  });

  it("marks a warning differently from an error", () => {
    render(<pre>{highlightOutput("Error: gone\nWarning: soon")}</pre>);

    expect(screen.getByText("Error: gone").style.color).not.toBe(
      screen.getByText("Warning: soon").style.color,
    );
  });

  it("leaves ordinary prose alone", () => {
    expect(colourOf("the file was written", highlightOutput("the file was written")))
      .toBeNull();
  });

  it("does not run one block's matching into the next", () => {
    /*
     * The patterns are module-level and `g` makes lastIndex stateful. Shared, the second
     * block would start scanning wherever the first one stopped — so a page showing two
     * outputs would colour the first correctly and the second from the middle.
     *
     * Compared as values rather than rendered: two renders of the same thing land in one
     * DOM and "found two" would pass whether or not the second was coloured.
     */
    const first = highlightOutput("n = 7");
    const second = highlightOutput("n = 7");

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second.some((node) => typeof node === "object")).toBe(true);
  });
});
