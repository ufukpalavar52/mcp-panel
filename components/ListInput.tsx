"use client";

import { useState } from "react";
import { CFormInput, CFormTextarea } from "@coreui/react";

/** Compared rather than the arrays themselves, which are new objects every render. */
function key(items: string[]): string {
  return items.join("\u0000");
}

/**
 * Text that survives being edited into a list.
 *
 * The obvious version — value from `items.join(separator)`, parse on every keystroke —
 * cannot have the separator typed into it. Typing one produces an empty last element,
 * parsing drops it, and the field re-renders from the parsed list without the separator
 * that was just typed. The list is right; the field is unusable. It happened twice: once
 * with commas in the table list, once with newlines in the allowed-commands box.
 *
 * So the text is kept here while it is being edited and the parsed list is reported
 * upwards. The two are re-synchronised only when the list says something this text does
 * not, which happens when a definition is loaded — never mid-typing.
 */
function useListText(items: string[], separator: string, parse: (text: string) => string[]) {
  const [text, setText] = useState(() => items.join(separator));
  const [seen, setSeen] = useState(() => key(items));
  const joined = key(items);

  // Adjusted while rendering rather than in an effect: React re-runs this component
  // before touching the DOM, so the field never paints the stale text. The comparison is
  // against the list this field last agreed with, which is what makes "orders," — a list
  // of one, mid-typing — leave the text alone.
  if (seen !== joined) {
    setSeen(joined);

    if (key(parse(text)) !== joined) {
      setText(items.join(separator));
    }
  }

  return [text, setText] as const;
}

/** Splits what was typed into a list, dropping the gaps between separators. */
function split(text: string, separator: string): string[] {
  return text
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

const parseCommas = (text: string) => split(text, ",");
const parseLines = (text: string) => split(text, "\n");

/** A one-line field holding a comma separated list. */
export default function CommaListInput({
  id,
  items,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useListText(items, ", ", parseCommas);

  return (
    <CFormInput
      id={id}
      className={className}
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        setText(event.target.value);
        onChange(parseCommas(event.target.value));
      }}
    />
  );
}

/**
 * A box holding one entry per line.
 *
 * The same field as above with a different separator, and it had the same bug: Enter
 * produced an empty last line, the parse dropped it, and the box re-rendered without the
 * newline. A list of allowed commands could be given exactly one entry.
 */
export function LineListInput({
  id,
  items,
  onChange,
  placeholder,
  rows = 4,
  className,
}: {
  id: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const [text, setText] = useListText(items, "\n", parseLines);

  return (
    <CFormTextarea
      id={id}
      className={className}
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        setText(event.target.value);
        onChange(parseLines(event.target.value));
      }}
    />
  );
}
