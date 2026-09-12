import "server-only";

/**
 * Reads this application's configuration from mcp-config.
 *
 * The panel is not a Spring client, so the two things a Spring client gets for free are
 * done here: fetching `/{application}/{profile}`, and resolving the `${NAME:default}`
 * placeholders the config server deliberately leaves alone. Leaving them alone is the
 * point — it is how a credential can be referenced by a served file without ever being
 * stored in one.
 *
 * Server side only. The values reach the browser through a route handler rather than
 * through `NEXT_PUBLIC_*`, because a `NEXT_PUBLIC_` variable is inlined into the bundle at
 * build time: it would put the configuration back in the artefact this change exists to
 * take it out of.
 */

const CONFIG_SERVER_URL = (
  process.env.CONFIG_SERVER_URL ?? "http://127.0.0.1:8888"
).replace(/\/$/, "");

const APPLICATION = process.env.CONFIG_APPLICATION ?? "mcp-panel";
const PROFILE = process.env.CONFIG_PROFILE ?? "default";

/**
 * Credentials for mcp-config, which refuses an anonymous caller.
 *
 * Read here rather than sent to the browser: this module is server-only, and the config
 * server's answer contains the whole stack's secrets. What reaches a visitor is the
 * handful of `panel.*` keys the route handler allows through.
 */
const CONFIG_USER = process.env.CONFIG_USER ?? "";
const CONFIG_PASSWORD = process.env.CONFIG_PASSWORD ?? "";

/** How long a fetched document is reused before the server asks again. */
const CACHE_MS = 30_000;

/** `${NAME}` or `${NAME:default}`, where the default may itself contain colons. */
const PLACEHOLDER = /\$\{([A-Za-z0-9_.-]+)(?::([^}]*))?\}/g;

export type PanelConfig = {
  apiUrl: string;
  title: string;
  environment: string;
  /**
   * Where these values came from.
   *
   * Reported rather than hidden: falling back is the right behaviour, but a panel that
   * silently runs on built-in defaults looks identical to one that is correctly
   * configured, and the difference matters the moment something is wrong.
   */
  source: "config-server" | "fallback";
  /** Why the fallback was used, when it was. */
  reason?: string;
};

type ConfigServerResponse = {
  propertySources?: { name: string; source: Record<string, unknown> }[];
};

let cached: { at: number; value: PanelConfig } | null = null;

export async function loadPanelConfig(): Promise<PanelConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value;
  }

  const value = await fetchPanelConfig();
  cached = { at: Date.now(), value };
  return value;
}

/** The basic header, or none when no user is configured. */
function authorization(): Record<string, string> {
  if (!CONFIG_USER) {
    return {};
  }

  const encoded = Buffer.from(`${CONFIG_USER}:${CONFIG_PASSWORD}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

async function fetchPanelConfig(): Promise<PanelConfig> {
  const url = `${CONFIG_SERVER_URL}/${APPLICATION}/${PROFILE}`;

  try {
    // `no-store` because this is configuration read at request time; Next's default
    // caching would freeze the first answer into the build's data cache and undo the
    // reason for reading it remotely at all.
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
      headers: authorization(),
    });

    if (response.status === 401) {
      // Named, because the fix is a pair of variables rather than anything about the
      // panel: "answered 401" sends the reader to look at the config server instead.
      return fallback(`${url} refused the credentials; set CONFIG_USER and CONFIG_PASSWORD`);
    }

    if (!response.ok) {
      return fallback(`${url} answered ${response.status}`);
    }

    const flattened = flatten((await response.json()) as ConfigServerResponse);

    return {
      apiUrl: trimSlash(resolve(flattened["panel.api-url"], defaults.apiUrl)),
      title: resolve(flattened["panel.title"], defaults.title),
      environment: resolve(flattened["panel.environment"], defaults.environment),
      source: "config-server",
    };
  } catch (error) {
    return fallback(error instanceof Error ? error.message : String(error));
  }
}

const defaults = {
  apiUrl: "http://localhost:8080",
  title: "MCP Panel",
  environment: "local",
};

/**
 * What to use when the config server cannot be reached.
 *
 * The panel degrades rather than refusing to start, unlike the gateway. The reasoning is
 * not that configuration matters less here but that the failure is already visible: if the
 * config server is down then so is the gateway, so the panel loads and reports an
 * unreachable API — which tells the operator more than a blank page would. The `source`
 * field is what keeps this from being a silent fallback.
 */
function fallback(reason: string): PanelConfig {
  return {
    apiUrl: trimSlash(process.env.NEXT_PUBLIC_API_URL || defaults.apiUrl),
    title: defaults.title,
    environment: defaults.environment,
    source: "fallback",
    reason,
  };
}

/**
 * Collapses the server's property sources into one map.
 *
 * Earlier sources win, which is the precedence a Spring client applies: the service's own
 * file overrides the shared `application.yml`.
 */
function flatten(body: ConfigServerResponse): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const sources = body.propertySources ?? [];

  for (let index = sources.length - 1; index >= 0; index--) {
    Object.assign(merged, sources[index].source);
  }
  return merged;
}

/**
 * Substitutes `${NAME:default}` against this process's environment.
 *
 * A placeholder naming an unset variable with no default resolves to the empty string
 * rather than being left as literal `${NAME}` — a value that reached the browser looking
 * like a placeholder would be reported as a broken URL somewhere far from the cause.
 */
function resolve(raw: unknown, fallbackValue: string): string {
  if (typeof raw !== "string") {
    return raw === undefined || raw === null ? fallbackValue : String(raw);
  }

  const substituted = raw.replace(
    PLACEHOLDER,
    (_match, name: string, defaultValue?: string) =>
      process.env[name] ?? defaultValue ?? "",
  );

  return substituted === "" ? fallbackValue : substituted;
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}
