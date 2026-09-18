import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Terminal } from "@/components/ui/Terminal";

/**
 * Keeping the newest line in view while a command is still writing.
 *
 * jsdom lays nothing out, so the geometry is stubbed: what is being tested is the rule
 * about *when* to scroll, which is the part with a decision in it. Whether a real browser
 * glides is not something a test can tell us.
 */
describe("a terminal that follows", () => {
  let scrolled: ScrollToOptions[] = [];
  let height = 1000;
  let top = 700;

  beforeEach(() => {
    scrolled = [];
    height = 1000;
    top = 700;
    vi.stubGlobal("matchMedia", () => ({ matches: false }));

    Object.defineProperty(HTMLPreElement.prototype, "scrollTo", {
      configurable: true,
      value: (options: ScrollToOptions) => scrolled.push(options),
    });

    // A block 300 tall, whose content and scroll position the tests move around.
    Object.defineProperty(HTMLPreElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 300,
    });
    Object.defineProperty(HTMLPreElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => height,
    });
    Object.defineProperty(HTMLPreElement.prototype, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
      },
    });
  });

  it("scrolls to the bottom when new output arrives", () => {
    const view = render(<Terminal follow>{"first line"}</Terminal>);
    scrolled = [];

    height = 1200;
    view.rerender(<Terminal follow>{"first line\nsecond line"}</Terminal>);

    expect(scrolled.at(-1)).toMatchObject({ top: 1200, behavior: "smooth" });
  });

  it("leaves somebody alone who has scrolled up to read", () => {
    /*
     * Yanking them back on every chunk makes a log unreadable at exactly the moment it has
     * something worth reading.
     */
    const view = render(<Terminal follow>{"first line"}</Terminal>);
    top = 100;
    scrolled = [];

    height = 1200;
    view.rerender(<Terminal follow>{"first line\nsecond line"}</Terminal>);

    expect(scrolled).toHaveLength(0);
  });

  it("takes up following again once they scroll back down", () => {
    /*
     * The measurement is of where the reader is, not of a decision they made once — so
     * coming back to the bottom needs no gesture beyond arriving there.
     */
    const view = render(<Terminal follow>{"a"}</Terminal>);

    top = 100;
    height = 1200;
    view.rerender(<Terminal follow>{"a\nb"}</Terminal>);
    expect(scrolled).toHaveLength(1); // the first paint only

    top = 900;
    height = 1400;
    view.rerender(<Terminal follow>{"a\nb\nc"}</Terminal>);

    expect(scrolled).toHaveLength(2);
  });

  it("measures against the height before the chunk, not after", () => {
    /*
     * The bug this replaced: measuring once the text is in the DOM always says "scrolled
     * up", because scrollHeight has grown and scrollTop has not. It never scrolled, and
     * nothing said why.
     */
    const view = render(<Terminal follow>{"a"}</Terminal>);
    scrolled = [];

    // At the bottom of 1000, and 400 more arrive at once.
    top = 700;
    height = 1400;
    view.rerender(<Terminal follow>{"a\nlots more"}</Terminal>);

    expect(scrolled).toHaveLength(1);
  });

  it("does not scroll a block nobody asked it to follow", () => {
    const view = render(<Terminal>{"done"}</Terminal>);
    scrolled = [];

    height = 1200;
    view.rerender(<Terminal>{"done, and more"}</Terminal>);

    expect(scrolled).toHaveLength(0);
  });

  it("jumps rather than glides when the reader asked for less movement", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));

    const view = render(<Terminal follow>{"first"}</Terminal>);
    scrolled = [];
    height = 1200;
    view.rerender(<Terminal follow>{"first\nsecond"}</Terminal>);

    expect(scrolled.at(-1)?.behavior).toBe("auto");
  });

  it("only boxes the height while it is following", () => {
    const { container, rerender } = render(<Terminal follow>{"x"}</Terminal>);
    expect(container.querySelector("pre")?.style.maxHeight).toBeTruthy();

    rerender(<Terminal>{"x"}</Terminal>);
    expect(container.querySelector("pre")?.style.maxHeight).toBeFalsy();
  });
});
