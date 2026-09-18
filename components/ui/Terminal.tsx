"use client";

import { useEffect, useRef, type ReactNode } from "react";

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

/**
 * How tall a followed block gets before it scrolls instead of growing the page.
 *
 * A share of the window rather than a fixed height: a log is read by filling the space
 * there is, and a box sized for a laptop is a letterbox on a monitor. A starting point
 * rather than a rule — the block can be dragged taller or shorter.
 *
 * Only applied while something is being followed. A finished command's output is a thing
 * to read from the top, and four lines in a tall frame helps nobody.
 */
const FOLLOW_HEIGHT = "75vh";

/** Close enough to the bottom to count as watching rather than reading. */
const AT_BOTTOM = 40;

export function Terminal({
  children,
  kind = "output",
  className = "",
  follow = false,
}: {
  children: string;
  kind?: Kind;
  className?: string;
  /** Keep the newest line in view as output arrives. For a command still running. */
  follow?: boolean;
}) {
  const box = useRef<HTMLPreElement>(null);

  // How tall the content was last time we looked, which is what makes the decision
  // possible at all.
  //
  // The obvious version measures whether the block is at the bottom when new text
  // arrives — and always decides it is not, because by then the text is in the DOM:
  // scrollHeight has grown and scrollTop has not. That was the first attempt here and it
  // silently never scrolled.
  //
  // Measuring against the *previous* height asks the question that was meant: where was
  // the reader relative to what they could see before this chunk landed. No listener, no
  // timer, and nothing to be confused by our own scrolling.
  const seen = useRef(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;

    // First paint has nothing to compare against, and the bottom is where a log starts.
    const wasAtBottom =
      seen.current === 0 || seen.current - el.scrollTop - el.clientHeight <= AT_BOTTOM;

    // Somebody who scrolled up to read a line is reading it, and yanking them back on
    // every chunk makes a log unreadable at exactly the moment it has something worth
    // reading. Scrolling back down takes up following again, because the measurement is
    // of where they are, not of a decision they made once.
    if (follow && wasAtBottom) {
      // Smooth, unless the reader has asked the system for less movement — a pane that
      // slides every second is precisely what that setting is about.
      const gentle =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === false;

      // Not every environment has scrollTo on an element — jsdom has none, and neither do
      // some older browsers. Falling back keeps the newest line in view without the
      // glide, which is the part that matters; throwing here would take the whole card
      // down over a scroll position.
      if (typeof el.scrollTo === "function") {
        el.scrollTo({ top: el.scrollHeight, behavior: gentle ? "smooth" : "auto" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }

    seen.current = el.scrollHeight;
  }, [children, follow]);

  return (
    <pre
      ref={box}
      className={`mono small border rounded-3 p-2 overflow-auto mb-1 ${className}`}
      style={
        follow
          ? {
              ...STYLE[kind],
              maxHeight: FOLLOW_HEIGHT,
              // Draggable, because no default is right for everybody: a share of the window
              // suits a log somebody is watching, and the person watching it is the one who
              // knows whether they want more of it or more of the page around it.
              resize: "vertical",
            }
          : STYLE[kind]
      }
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
