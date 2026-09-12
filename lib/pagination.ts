/** A gap in a numbered pager, where pages were left out. */
export const GAP = "gap" as const;

export type PageSlot = number | typeof GAP;

/**
 * The page numbers to show, with gaps where the rest were left out.
 *
 * Every page as a button is fine at eight and unusable at eighty, and the column this sits
 * in is narrow. What somebody needs to reach directly is the first page, the last one, and
 * the ones either side of where they are; everything else is a jump they make in two
 * clicks instead of one.
 *
 * Zero-based, as the gateway counts. Returns `[0]` for an empty list rather than nothing,
 * because a pager with no current page has nowhere to put the highlight — callers that do
 * not want a pager at all should not draw one.
 *
 * @param current the page being shown
 * @param pages   how many there are
 * @param around  how many neighbours to keep either side of the current page
 */
export function pageSlots(current: number, pages: number, around = 1): PageSlot[] {
  const last = Math.max(0, pages - 1);
  const here = Math.min(Math.max(0, current), last);

  const wanted = new Set<number>([0, last]);
  for (let page = here - around; page <= here + around; page++) {
    if (page >= 0 && page <= last) wanted.add(page);
  }

  const shown = [...wanted].sort((a, b) => a - b);
  const slots: PageSlot[] = [];

  for (const [index, page] of shown.entries()) {
    const previous = shown[index - 1];

    // A gap only where something is actually missing. One page missing is drawn as the
    // page itself: "1 … 3" is longer than "1 2 3" and says less.
    if (previous !== undefined && page - previous === 2) {
      slots.push(page - 1);
    } else if (previous !== undefined && page - previous > 2) {
      slots.push(GAP);
    }

    slots.push(page);
  }

  return slots;
}
