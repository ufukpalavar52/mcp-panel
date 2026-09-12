"use client";

import { useSyncExternalStore } from "react";
import type { MessageKey } from "@/lib/i18n/tr";

/**
 * Toasts, held in a module store like every other shared state in the panel.
 *
 * A success carries a message *key*, not a rendered string: the locale can change while a
 * toast is on screen, and a key resolved at render time follows it. A failure carries the
 * gateway's own text instead, because that text names the actual problem — "Tool name
 * already in use" tells the operator what to change, and a generic key does not.
 */

export type Toast = {
  id: number;
  kind: "success" | "failure";
  /** Set for a success. Resolved by the renderer so it follows the current locale. */
  messageKey?: MessageKey;
  params?: Record<string, string | number>;
  /** Set for a failure: the message the gateway sent. */
  text?: string;
};

let state: Toast[] = [];
let sequence = 0;
const listeners = new Set<() => void>();

function emit() {
  state = [...state];
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

/** Empty on the server; toasts only ever result from something the user did. */
const EMPTY: Toast[] = [];

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function dismissToast(id: number) {
  state = state.filter((toast) => toast.id !== id);
  emit();
}

export const notify = {
  success(messageKey: MessageKey, params?: Record<string, string | number>) {
    state = [...state, { id: ++sequence, kind: "success", messageKey, params }];
    emit();
  },

  failure(text: string) {
    state = [...state, { id: ++sequence, kind: "failure", text }];
    emit();
  },

  /**
   * A failure the panel itself worded.
   *
   * Almost every failure carries the gateway's text, which names the actual problem. The
   * exception is a failure the gateway never answered — it is unreachable — and that
   * sentence is the panel's own, so it has to follow the interface language.
   */
  failureKey(messageKey: MessageKey, params?: Record<string, string | number>) {
    state = [...state, { id: ++sequence, kind: "failure", messageKey, params }];
    emit();
  },
};
