import { describe, expect, it } from "vitest";

import { GAP, pageSlots } from "@/lib/pagination";

/**
 * Which page numbers a pager offers.
 *
 * Every page as a button is fine at eight and unusable at eighty, and the console's
 * sidebar is a narrow column. What has to be reachable in one click is the first page, the
 * last one, and the neighbours of where you are.
 */
describe("pageSlots", () => {
  it("shows every page while they all fit", () => {
    expect(pageSlots(0, 4)).toEqual([0, 1, 2, 3]);
  });

  it("keeps the first, the last and the neighbours", () => {
    expect(pageSlots(5, 12)).toEqual([0, GAP, 4, 5, 6, GAP, 11]);
  });

  it("has nothing to leave out near the start", () => {
    expect(pageSlots(1, 12)).toEqual([0, 1, 2, GAP, 11]);
  });

  it("has nothing to leave out near the end", () => {
    expect(pageSlots(10, 12)).toEqual([0, GAP, 9, 10, 11]);
  });

  it("draws a single missing page rather than a gap standing for it", () => {
    // "1 … 3" is longer than "1 2 3" and says less.
    expect(pageSlots(3, 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("clamps a page that is not there", () => {
    // A stale click, or a list that shrank under the reader.
    expect(pageSlots(99, 3)).toEqual([0, 1, 2]);
    expect(pageSlots(-4, 3)).toEqual([0, 1, 2]);
  });

  it("has one page when there is nothing", () => {
    // Somewhere to put the highlight. A caller that wants no pager draws none.
    expect(pageSlots(0, 0)).toEqual([0]);
  });
});
