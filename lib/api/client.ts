"use client";

import {
  ApiRequestError,
  ApiUnreachableError,
  type ApiErrorBody,
} from "./errors";
import {
  clearSession,
  currentSession,
  updateTokens,
} from "@/lib/auth/session-store";

/**
 * Where the gateway lives, according to mcp-config.
 *
 * Fetched once from this app's own `/api/config`, which reads the config server on the
 * server side. It is not a `NEXT_PUBLIC_` variable any more: those are inlined into the
 * bundle at build time, so the address would be fixed at build and a config change would
 * need a rebuild to take effect.
 *
 * `NEXT_PUBLIC_API_URL` still works as the last resort inside that handler, which is what
 * keeps a checkout with no config server running usable.
 */
let configPromise: Promise<PanelRuntimeConfig> | null = null;

export type PanelRuntimeConfig = {
  apiUrl: string;
  title: string;
  environment: string;
  source: "config-server" | "fallback";
  reason?: string;
};

const FALLBACK_CONFIG: PanelRuntimeConfig = {
  apiUrl: "http://localhost:8080",
  title: "MCP Panel",
  environment: "local",
  source: "fallback",
  reason: "The panel could not read its own configuration endpoint",
};

/**
 * Resolved once per page load and shared by every caller.
 *
 * A single in-flight promise rather than a fetch per request: the first few API calls
 * happen together as the page mounts, and without this they would each ask.
 */
export function panelConfig(): Promise<PanelRuntimeConfig> {
  configPromise ??= fetch("/api/config", { cache: "no-store" })
    .then((response) =>
      response.ok
        ? (response.json() as Promise<PanelRuntimeConfig>)
        : FALLBACK_CONFIG,
    )
    .catch(() => FALLBACK_CONFIG);

  return configPromise;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skips the Authorization header and the refresh retry; used by the auth endpoints. */
  anonymous?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
};

/**
 * Single in-flight refresh.
 *
 * When several requests hit a stale access token at once, only the first one refreshes
 * and the rest await the same promise. Without this the second refresh would present an
 * already rotated token and be rejected, signing the user out mid-session.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function buildUrl(path: string, query?: RequestOptions["query"]) {
  const { apiUrl } = await panelConfig();
  const url = new URL(apiUrl + path);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function readError(response: Response): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiRequestError(body);
  } catch {
    // Not every failure carries a JSON body, a proxy error page for instance.
    return new ApiRequestError({
      status: response.status,
      error: "UNEXPECTED",
      // The gateway's own messages come from the gateway and carry its language; this is
      // the fallback for a response that is not one of them — a proxy's error page.
      message: `Request failed (${response.status})`,
      path: response.url,
      timestamp: new Date().toISOString(),
    });
  }
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const session = currentSession();
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (!options.anonymous && session) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  try {
    return await fetch(await buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (cause) {
    throw new ApiUnreachableError(cause);
  }
}

/** Exchanges the refresh token for a new pair. Returns false when the session is gone. */
async function refreshTokens(): Promise<boolean> {
  const session = currentSession();
  if (!session) return false;

  try {
    const response = await fetch(await buildUrl("/api/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    if (!response.ok) return false;

    const body = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    updateTokens(body.accessToken, body.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Performs a request, transparently refreshing an expired access token once.
 *
 * A second 401 after a successful refresh means the session is genuinely invalid, so it
 * is cleared rather than retried again.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && !options.anonymous && currentSession()) {
    refreshInFlight ??= refreshTokens().finally(() => {
      refreshInFlight = null;
    });

    const refreshed = await refreshInFlight;

    if (!refreshed) {
      clearSession();
      throw await readError(response);
    }
    response = await send(path, options);

    if (response.status === 401) {
      clearSession();
    }
  }

  if (!response.ok) {
    throw await readError(response);
  }
  // Any empty body, not only a 204. An endpoint answering 202 with nothing in it went
  // straight to json() and threw "Unexpected end of JSON input" — a parser error standing
  // in for a request that had in fact succeeded. Content-Length is the honest test: what
  // matters is whether there is a body, not which success code carried it.
  const empty = response.status === 204
    || response.headers.get("content-length") === "0";

  if (empty) {
    return undefined as T;
  }

  const text = await response.text();

  // A body that is present but blank counts too: some proxies drop Content-Length.
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    request<T>(path, { method: "GET", query }),

  post: <T>(path: string, body?: unknown, options?: { anonymous?: boolean }) =>
    request<T>(path, { method: "POST", body, anonymous: options?.anonymous }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

