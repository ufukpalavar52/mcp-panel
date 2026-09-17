"use client";

import { useSyncExternalStore } from "react";
import { clearToasts } from "@/lib/ui/toast-store";

/** Account shape returned by the gateway alongside the tokens. */
export type SessionUser = {
  id: number;
  email: string;
  fullName: string;
  role: "admin" | "developer" | "viewer";
  status: "active" | "invited" | "suspended";

  /**
   * Whether this password was chosen by somebody else.
   *
   * Set when an administrator created the account with a password they picked. Two people
   * know it and only one owns the account, so the panel shows nothing but the password
   * screen until it has been replaced.
   */
  mustChangePassword?: boolean;
  team: string | null;
  avatarUrl: string | null;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

const STORAGE_KEY = "mcp-session";

/**
 * Holds the token pair and the signed in account.
 *
 * Same pattern as the other stores: the server renders with no session and the stored
 * one is picked up after hydration, so the markup never disagrees with itself.
 *
 * The tokens live in localStorage because the gateway returns them in the response
 * body. That is readable by any script on the page, so an XSS bug would leak them;
 * moving to an httpOnly cookie would need the gateway to set the cookie instead.
 */

let state: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function loadOnce() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw) as Session;
      emit();
    }
  } catch {
    // Corrupt entry: start signed out rather than crashing the app.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  loadOnce();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot(): Session | null {
  return null;
}

export function setSession(session: Session) {
  state = session;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Session survives in memory for this tab only.
  }
  emit();
}

/** Replaces just the tokens, keeping the account, after a refresh. */
export function updateTokens(accessToken: string, refreshToken: string) {
  if (!state) return;
  setSession({ ...state, accessToken, refreshToken });
}

export function clearSession() {
  state = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }

  // The toast queue goes with it. It is module state and the login screen draws no
  // toaster, so anything still queued waited invisibly and turned up after the next
  // sign-in — describing something that happened to a session that no longer exists.
  clearToasts();
  emit();
}

/** Read outside React, for the fetch wrapper. */
export function currentSession() {
  return state;
}

export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Whether the store has consulted localStorage yet.
 *
 * A guard must not redirect on the very first render, when a stored session simply has
 * not been read back yet.
 */
export function useSessionResolved() {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
}
