import type { ReactNode } from "react";

/**
 * Colour for a terminal block, on the dark ground those blocks use.
 *
 * Two different jobs, and only one of them is safe to guess at.
 *
 * A *command* is known to be shell — the panel wrote the template and the guardrails read
 * it as shell before letting it run — so naming its parts is a fact, not a heuristic, and
 * the colour tells somebody reading an approval where the verb ends and the arguments
 * begin.
 *
 * *Output* is whatever a program printed, and almost nothing about it is knowable. So only
 * the things that are: numbers, quoted text, and the handful of words a program uses when
 * it is reporting trouble. Anything more would be inventing meaning and painting it on.
 */

/** Deliberately fixed, like the ground they sit on: a terminal is dark in a light room. */
const COLOUR = {
  command: "#7ee787",
  flag: "#79c0ff",
  string: "#ffa657",
  path: "#d2a8ff",
  operator: "#ff7b72",
  number: "#79c0ff",
  comment: "#8b949e",
  error: "#ff7b72",
  warning: "#e3b341",
} as const;

type Kind = keyof typeof COLOUR;

function paint(text: string, kind: Kind, key: number): ReactNode {
  return (
    <span key={key} style={{ color: COLOUR[kind] }}>
      {text}
    </span>
  );
}

/**
 * The pieces of a shell command, in the order a shell would read them.
 *
 * Quoted text first, and that ordering is the whole correctness of this: a path inside
 * `'…'` is text, and a matcher that took paths first would break the quote in half and
 * colour its two halves differently. Everything after it can assume it is outside quotes.
 */
const COMMAND = new RegExp(
  [
    "(?<comment>#[^\\n]*)",
    "(?<string>'[^']*'|\"[^\"]*\")",
    "(?<operator><<-?|>>|[|&;<>]+)",
    "(?<flag>(?<=\\s)--?[A-Za-z][\\w-]*)",
    "(?<path>(?<![\\w/])/[\\w./-]+)",
    "(?<number>(?<![\\w.])\\d+(?![\\w.]))",
  ].join("|"),
  "g",
);

/** Words a program reaches for when something has gone wrong, and when it nearly has. */
const TROUBLE = /^(.*\b(?:error|exception|traceback|fatal|failed|refused|denied)\b.*)$/gim;
const CAUTION = /^(.*\b(?:warning|warn|deprecated)\b.*)$/gim;

const OUTPUT = new RegExp(
  [
    `(?<error>${TROUBLE.source.slice(1, -1)})`,
    `(?<warning>${CAUTION.source.slice(1, -1)})`,
    "(?<string>'[^']*'|\"[^\"]*\")",
    "(?<number>(?<![\\w.])-?\\d+(?:\\.\\d+)?(?![\\w.]))",
  ].join("|"),
  "gim",
);

/**
 * Splits `text` on `pattern`, painting each named group and leaving the rest alone.
 *
 * Returns the text as it was when nothing matched, so a block with no colour in it costs
 * one array and no wrapping elements.
 */
function tokenise(text: string, pattern: RegExp, first?: Kind): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;

  // A fresh copy: these patterns are module-level and `g` makes lastIndex stateful, so
  // sharing one across two blocks would have the second start wherever the first stopped.
  const scan = new RegExp(pattern.source, pattern.flags);

  for (let match = scan.exec(text); match; match = scan.exec(text)) {
    const groups = match.groups ?? {};
    const kind = (Object.keys(groups) as Kind[]).find((name) => groups[name] != null);

    if (!kind) continue;

    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(paint(match[0], kind, key++));
    last = match.index + match[0].length;
  }

  if (last === 0) return [first ? paint(text, first, key) : text];
  if (last < text.length) out.push(text.slice(last));

  return out;
}

/**
 * A command, with its verb named.
 *
 * The first word is painted separately because it is the one thing a person checks before
 * approving: `cat` and `rm` occupy the same space on a screen and mean very different
 * days. `sudo` counts as part of it rather than as a word of its own — it is not the verb,
 * but nobody reads it as an argument either.
 */
export function highlightCommand(text: string): ReactNode[] {
  const verb = /^(\s*(?:sudo\s+)?[\w./-]+)/.exec(text);

  if (!verb) return tokenise(text, COMMAND);

  return [
    paint(verb[1], "command", -1),
    ...tokenise(text.slice(verb[1].length), COMMAND),
  ];
}

/** Output, with only what is actually knowable about it picked out. */
export function highlightOutput(text: string): ReactNode[] {
  return tokenise(text, OUTPUT);
}
