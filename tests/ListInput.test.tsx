import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CommaListInput, { LineListInput } from "@/components/ListInput";

/**
 * The separator has to survive being typed.
 *
 * The obvious implementation cannot: value from `items.join(", ")`, parsed on every
 * keystroke, so a comma produces an empty last element, parsing drops it, and the field
 * re-renders without the character just typed. The list stays right and the field is
 * unusable — you cannot enter a second table name.
 */
describe("CommaListInput", () => {
  /** A parent that keeps the list, the way the real editors do. */
  function Host({ onChange }: { onChange?: (items: string[]) => void }) {
    const [items, setItems] = useState<string[]>(["orders"]);

    return (
      <CommaListInput
        id="tables"
        items={items}
        onChange={(next) => {
          setItems(next);
          onChange?.(next);
        }}
      />
    );
  }

  it("keeps a comma that was just typed", async () => {
    const user = userEvent.setup();
    render(<Host />);

    const field = screen.getByRole("textbox");
    await user.type(field, ", customers");

    expect(field).toHaveValue("orders, customers");
  });

  it("reports the list without the empty gap between separators", async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    render(<Host onChange={seen} />);

    await user.type(screen.getByRole("textbox"), ",");

    // Mid-typing the text ends in a separator; the list it stands for does not have an
    // extra empty member, and the parent must never be told it does.
    expect(seen).toHaveBeenLastCalledWith(["orders"]);
  });

  it("takes the list a parent loads over what is on screen", () => {
    // A definition arriving from the gateway has to replace the field's contents; only
    // typing is protected from the re-synchronisation, not loading.
    const { rerender } = render(
      <CommaListInput id="tables" items={["orders"]} onChange={() => {}} />,
    );

    rerender(
      <CommaListInput id="tables" items={["accounts", "options"]} onChange={() => {}} />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("accounts, options");
  });

  it("starts from the list it is given", () => {
    render(
      <CommaListInput id="tables" items={["a", "b"]} onChange={() => {}} />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("a, b");
  });
});

/**
 * The same field with a different separator, and it had the same bug.
 *
 * Enter produced an empty last line, the parse dropped it, and the box re-rendered without
 * the newline that had just been typed — so a list of allowed commands could be given
 * exactly one entry, which is the list that lets nothing through but the first thing.
 */
describe("LineListInput", () => {
  /** A parent that keeps the list, the way the action editor does. */
  function Lines({ onChange }: { onChange?: (items: string[]) => void }) {
    const [items, setItems] = useState<string[]>(["systemctl status"]);

    return (
      <LineListInput
        id="allowed"
        items={items}
        onChange={(next) => {
          setItems(next);
          onChange?.(next);
        }}
      />
    );
  }

  it("lets a newline be typed", async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    render(<Lines onChange={seen} />);

    const box = screen.getByRole("textbox");
    await user.type(box, "{Enter}journalctl -u");

    expect(box).toHaveValue("systemctl status\njournalctl -u");
    expect(seen).toHaveBeenLastCalledWith(["systemctl status", "journalctl -u"]);
  });

  it("reports no empty entry while a line is still blank", async () => {
    // Mid-typing the text ends in a newline; the list it stands for has no extra empty
    // member, and dropping it is what used to erase the newline as well.
    const user = userEvent.setup();
    const seen = vi.fn();
    render(<Lines onChange={seen} />);

    await user.type(screen.getByRole("textbox"), "{Enter}");

    expect(seen).toHaveBeenLastCalledWith(["systemctl status"]);
    expect(screen.getByRole("textbox")).toHaveValue("systemctl status\n");
  });

  it("shows one entry per line", () => {
    render(
      <LineListInput
        id="allowed"
        items={["systemctl status", "journalctl -u"]}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("systemctl status\njournalctl -u");
  });

  it("takes a list loaded after it was first drawn", () => {
    // A definition arriving from the gateway must reach a field the operator has not
    // touched; the guard against overwriting is about typing, not about loading.
    const { rerender } = render(
      <LineListInput id="allowed" items={[]} onChange={() => {}} />,
    );

    rerender(<LineListInput id="allowed" items={["systemctl restart"]} onChange={() => {}} />);

    expect(screen.getByRole("textbox")).toHaveValue("systemctl restart");
  });
});
