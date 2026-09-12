"use client";

import { useCallback } from "react";
import { en } from "./en";
import { tr, type MessageKey } from "./tr";
import { useLocale, type Locale } from "./locale-store";

export type { MessageKey } from "./tr";
export {
  useLocale,
  setLocale,
  locales,
  localeNames,
  DEFAULT_LOCALE,
  type Locale,
} from "./locale-store";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { tr, en };

export type TranslateVars = Record<string, string | number>;

/**
 * Fills placeholders of the form {name}.
 *
 * Double braces ({{key}}) are an escape and are left as they are — some of this text shows
 * the template syntax to the reader as an example.
 */
function interpolate(template: string, vars?: TranslateVars) {
  if (!vars) return template;

  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string, offset: number, full: string) => {
      const escaped =
        full[offset - 1] === "{" || full[offset + match.length] === "}";
      if (escaped) return match;
      return key in vars ? String(vars[key]) : match;
    },
  );
}

export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/** The one way a component reaches translated text. */
export function useT(): Translate {
  const locale = useLocale();

  return useCallback<Translate>(
    (key, vars) => interpolate(dictionaries[locale][key], vars),
    [locale],
  );
}

/** The locale tag to format numbers and dates with. */
export function useIntlLocale() {
  return useLocale() === "en" ? "en-US" : "tr-TR";
}
