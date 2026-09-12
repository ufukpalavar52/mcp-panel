"use client";

import { useSyncExternalStore } from "react";

import { conversationsApi } from "./endpoints";
import type { ConversationPayload } from "./types";

/** How many sessions a sidebar page holds. Small: it is a column, not a table. */
export const PAGE_SIZE = 15;

export type ConversationsState = {
  data: ConversationPayload[];
  /** Zero-based, as the gateway counts. */
  page: number;
  /** Every conversation matching the current search, not just this page. */
  total: number;
  search: string;
  loading: boolean;
  error: string | null;
};

const empty: ConversationsState = {
  data: [],
  page: 0,
  total: 0,
  search: "",
  loading: true,
  error: null,
};

/**
 * The caller's console sessions, a page at a time.
 *
 * Its own store rather than the generic one, because this list has state the others do
 * not: which page is being shown and what is being looked for. Both have to survive the
 * reload that follows every question — a sidebar that jumped back to page one and cleared
 * the search box each time somebody typed would be unusable while searching.
 *
 * Shared at module level for the same reason the others are: the store is read beside the
 * thread it belongs to, and a per-component fetch would load it twice and let the copies
 * drift.
 */
function createConversationsStore() {
  let state: ConversationsState = empty;
  let started = false;
  let inFlight: Promise<void> | null = null;

  // Bumped on every request; a reply for anything but the newest is dropped. Typing in the
  // search box starts a request per keystroke, and without this the slowest one to come
  // back wins — which is how a list ends up showing the results for "tbl" after "tblAcc".
  let latest = 0;

  const listeners = new Set<() => void>();
  const serverState = empty;

  function setState(next: ConversationsState) {
    state = next;
    for (const listener of listeners) listener();
  }

  async function load(): Promise<void> {
    const request = ++latest;
    setState({ ...state, loading: true, error: null });

    try {
      const page = await conversationsApi.list(state.page, PAGE_SIZE, state.search);
      if (request !== latest) return;

      setState({
        ...state,
        data: page.content,
        total: page.totalElements,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (request !== latest) return;

      setState({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      });
    }
  }

  async function reload(): Promise<void> {
    // Collapsed, so several questions in a row do not stampede the list.
    inFlight ??= load().finally(() => {
      inFlight = null;
    });

    return inFlight;
  }

  /** Moves to a page, if there is one there. */
  function setPage(page: number) {
    const last = Math.max(0, Math.ceil(state.total / PAGE_SIZE) - 1);
    const wanted = Math.min(Math.max(0, page), last);

    if (wanted === state.page) return;

    state = { ...state, page: wanted };
    void reload();
  }

  /**
   * Looks for something, from the first page.
   *
   * Back to page one, because page four of the old results is not page four of the new
   * ones — it is usually past the end of them.
   */
  function setSearch(search: string) {
    if (search === state.search) return;

    state = { ...state, search, page: 0 };
    void reload();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);

    if (!started) {
      started = true;
      void reload();
    }
    return () => {
      listeners.delete(listener);
    };
  }

  /** Drops everything so the next subscriber loads again; used on sign out. */
  function reset() {
    started = false;
    latest++;
    setState(empty);
  }

  function useResource(): ConversationsState {
    return useSyncExternalStore(
      subscribe,
      () => state,
      () => serverState,
    );
  }

  return { useResource, reload, reset, setPage, setSearch };
}

const store = createConversationsStore();

export function useConversations() {
  return store.useResource();
}

export const conversationsStore = store;
