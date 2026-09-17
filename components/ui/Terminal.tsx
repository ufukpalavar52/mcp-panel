"use client";

import type { ReactNode } from "react";

import { highlightCommand, highlightOutput } from "@/lib/ui/shell-highlight";

/**
 * A terminal block: what the machine was told, or what it said back.
 *
 * One component so the three kinds cannot drift into three slightly different dark greys.
 * The ground is fixed rather than themed — a terminal is dark in a light room too, and
 * following the theme would make the same output look like two different kinds of thing
 * depending on who was reading it.
 */
const GROUND = "#11161d";
const EDGE = "#2a3441";

const STYLE: Record<Kind, React.CSSProperties> = {
  command: { background: GROUND, color: "#d5dbe3", borderColor: EDGE },
  output: { background: GROUND, color: "#d5dbe3", borderColor: EDGE },

  // The same ground and a red edge: stderr is the same voice on a different channel, not
  // a different kind of thing. A red *fill* said "this block is an error", which a command
  // writing progress to stderr — which is most of them — turned into a lie.
  error: {
    background: GROUND,
    color: "#ffb4ab",
    borderColor: EDGE,
    borderLeft: "3px solid #d9534f",
  },
};

type Kind = "command" | "output" | "error";

export function Terminal({
  children,
  kind = "output",
  className = "",
}: {
  children: string;
  kind?: Kind;
  className?: string;
}) {
  return (
    <pre
      className={`mono small border rounded-3 p-2 overflow-auto mb-1 ${className}`}
      style={STYLE[kind]}
    >
      {body(children, kind)}
    </pre>
  );
}

function body(text: string, kind: Kind): ReactNode {
  // stderr is already the colour it is. Painting error words inside a block that is
  // entirely an error report would highlight every line of it, which highlights nothing.
  if (kind === "error") return text;

  return kind === "command" ? highlightCommand(text) : highlightOutput(text);
}
