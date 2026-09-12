"use client";

import { useSyncExternalStore } from "react";

export const locales = ["tr", "en"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
};

export const DEFAULT_LOCALE: Locale = "tr";
const STORAGE_KEY = "mcp-locale";

/**
 * The language is held with useSyncExternalStore, like the panel's other stores.
 *
 * The reason is hydration: the server always renders in DEFAULT_LOCALE and the stored
 * language only takes over once hydration has finished. This is the one way to get that
 * right without a setState-in-effect or a text mismatch.
 */

let state: Locale = DEFAULT_LOCALE;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function applyToDocument(locale: Locale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

function loadOnce() {
  if (loaded) return;
  loaded = true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "tr" || stored === "en") {
      state = stored;
      applyToDocument(state);
      emit();
      return;
    }
    // With nothing stored, follow the browser's preference.
    const preferred = navigator.language.toLowerCase().startsWith("en")
      ? "en"
      : "tr";
    if (preferred !== state) {
      state = preferred;
      applyToDocument(state);
      emit();
    }
  } catch {
    // Unreachable storage: carry on in the default language.
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

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function setLocale(locale: Locale) {
  state = locale;
  applyToDocument(locale);
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // If it cannot be written, the choice lasts for this session only.
  }
  emit();
}

export function useLocale() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
