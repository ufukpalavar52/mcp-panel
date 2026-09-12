"use client";

import { useSyncExternalStore } from "react";

export type ResourceState<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
};

/**
 * A shared, lazily loaded collection.
 *
 * The panel reads the same lists from several places at once: models appear on their own
 * page, in the definition editor and on the dashboard. A per-component fetch would load
 * each of them several times and let the copies drift apart, so the state lives in the
 * module and every subscriber sees the same array.
 *
 * The first subscriber triggers the load; later ones join the result. Mutations call
 * `reload` so the server stays the single source of truth rather than the client trying
 * to guess what the write produced.
 */
export function createResourceStore<T>(load: () => Promise<T[]>) {
  let state: ResourceState<T> = { data: [], loading: true, error: null };
  let started = false;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const serverState: ResourceState<T> = { data: [], loading: true, error: null };

  function emit() {
    for (const listener of listeners) listener();
  }

  function setState(next: ResourceState<T>) {
    state = next;
    emit();
  }

  async function reload(): Promise<void> {
    // Collapse concurrent reloads: several mutations in a row must not stampede.
    inFlight ??= (async () => {
      setState({ ...state, loading: true, error: null });
      try {
        setState({ data: await load(), loading: false, error: null });
      } catch (error) {
        setState({
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        });
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
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

  /** Drops the cache so the next subscriber loads again; used on sign out. */
  function reset() {
    started = false;
    setState({ data: [], loading: true, error: null });
  }

  function useResource(): ResourceState<T> {
    return useSyncExternalStore(
      subscribe,
      () => state,
      () => serverState,
    );
  }

  return { useResource, reload, reset };
}
