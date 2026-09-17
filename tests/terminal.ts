import type { MatcherFunction } from "@testing-library/dom";

/**
 * Finds text inside a terminal block, where colour has split it across elements.
 *
 * Testing Library's default matcher reads an element's *direct* text children and ignores
 * the ones inside child elements. A highlighted command is nothing but child elements — the
 * verb in one span, a flag in another — so `getByText(/cat > \/tmp/)` stopped matching the
 * moment the blocks were coloured, though the text on screen had not changed at all.
 *
 * Matches against the whole block's text instead, and only on the block, so a match cannot
 * be satisfied by some ancestor that happens to contain it.
 */
export function inTerminal(pattern: RegExp): MatcherFunction {
  return (_content, element) =>
    element?.tagName === "PRE" && pattern.test(element.textContent ?? "");
}
