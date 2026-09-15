import type { MessageKey } from "./i18n/tr";

/**
 * MCP definitions: a system prompt, its actions and its dynamic inputs, described
 * together. An action's template fields carry {{input_key}} placeholders, which are
 * filled from the inputs at run time.
 */

export type InputType =
  | "text"
  | "password"
  | "number"
  | "textarea"
  /**
   * A body of text bound for a quoted heredoc: a file's contents, a configuration, a
   * script.
   *
   * The one type exempt from the shell-metacharacter scan every substituted value goes
   * through — a file made of newlines cannot pass that scan and should not be expected to.
   * The rule that replaces it is narrower: the command must put this value in a *quoted*
   * heredoc, where the shell expands nothing, and the value may not contain the terminator
   * that would close the block early.
   *
   * `textarea` is not this. It only means a bigger box, and it keeps the scan.
   */
  | "block"
  | "select"
  | "boolean"
  | "date";

export const inputTypeKeys: Record<InputType, MessageKey> = {
  text: "inputs.type.text",
  password: "inputs.type.password",
  number: "inputs.type.number",
  textarea: "inputs.type.textarea",
  block: "inputs.type.block",
  select: "inputs.type.select",
  boolean: "inputs.type.boolean",
  date: "inputs.type.date",
};

/**
 * Who is allowed to decide a parameter's value.
 *
 * `type` says what the value looks like; this says who chooses it. Confusing the two is
 * the road to a model inventing a hostname.
 */
export type InputSource = "prompt" | "caller" | "fixed";

export const inputSourceKeys: Record<InputSource, MessageKey> = {
  prompt: "inputs.source.prompt",
  caller: "inputs.source.caller",
  fixed: "inputs.source.fixed",
};

export const inputSourceHintKeys: Record<InputSource, MessageKey> = {
  prompt: "inputs.source.promptHint",
  caller: "inputs.source.callerHint",
  fixed: "inputs.source.fixedHint",
};

export type DynamicInput = {
  id: string;
  /** Appears in templates as {{key}}. */
  key: string;
  label: string;
  type: InputType;
  required: boolean;
  defaultValue: string;
  placeholder: string;
  /** Only used by the `select` type. */
  options: string[];
  /** Who may decide the value. Defaults to `prompt`, which is the older behaviour. */
  source: InputSource;
};

export type ActionKind = "rest" | "ssh" | "db";

export const actionKindKeys: Record<ActionKind, MessageKey> = {
  rest: "action.kind.rest",
  ssh: "action.kind.ssh",
  db: "action.kind.db",
};

/**
 * The name a newly created action starts with.
 *
 * Separate from {@link actionKindKeys}, which labels the kind wherever it is shown. This one
 * is written into the action and saved with it, so it is looked up once, at creation, and
 * never again: renaming the interface language must not rename somebody's saved action.
 */
export const newActionKeys: Record<ActionKind, MessageKey> = {
  rest: "action.new.rest",
  ssh: "action.new.ssh",
  db: "action.new.db",
};

export const actionKindColors: Record<ActionKind, string> = {
  rest: "primary",
  ssh: "info",
  db: "warning",
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type SshAuth = "key" | "password" | "agent";

/**
 * Static: the command is written here, fixed.
 * Dynamic: the model writes it, guided by the system prompt and the allow list.
 */
export type CommandMode = "static" | "dynamic";

export const commandModeKeys: Record<CommandMode, MessageKey> = {
  static: "action.ssh.mode.staticCommand",
  dynamic: "action.ssh.mode.dynamicCommand",
};

/** How many servers the action runs on. */
export type TargetMode = "single" | "list" | "group";

export const targetModeKeys: Record<TargetMode, MessageKey> = {
  single: "action.ssh.mode.single",
  list: "action.ssh.mode.list",
  group: "action.ssh.mode.group",
};

/** How a multi-server run is spread out. */
export type RunStrategy = "sequential" | "parallel" | "rolling";

export const runStrategyKeys: Record<RunStrategy, MessageKey> = {
  sequential: "action.ssh.strategy.sequential",
  parallel: "action.ssh.strategy.parallel",
  rolling: "action.ssh.strategy.rolling",
};

export const runStrategyHintKeys: Record<RunStrategy, MessageKey> = {
  sequential: "action.ssh.strategyHint.sequential",
  parallel: "action.ssh.strategyHint.parallel",
  rolling: "action.ssh.strategyHint.rolling",
};
export type DbEngine = "postgres" | "mysql" | "mssql" | "sqlite" | "mongodb";

/**
 * Static: the query is written here, fixed; only its {{input}} placeholders are filled at
 * run time.
 * Dynamic: the model writes the query at run time, guided by the system prompt and the
 * guardrails set here.
 */
export type DbQueryMode = "static" | "dynamic";

export const dbQueryModeKeys: Record<DbQueryMode, MessageKey> = {
  static: "action.db.mode.static",
  dynamic: "action.db.mode.dynamic",
};

export type SqlOperation = "select" | "insert" | "update" | "delete";

export const sqlOperationLabels: Record<SqlOperation, string> = {
  select: "SELECT",
  insert: "INSERT",
  update: "UPDATE",
  delete: "DELETE",
};

type ActionBase = {
  /**
   * Its identity within this form. React keys and field `id`s are derived from it, and it
   * is independent of the server because an unsaved action needs one too.
   */
  id: string;

  /**
   * Its identity in the gateway. `null` for an action that has never been saved.
   *
   * Kept apart because the two answer different questions: one is "which row is this",
   * the other "which record on the server". Loading used to throw the server's away and
   * put the client's in its place, which sent the schema request to
   * `.../actions/NaN/introspect`.
   */
  actionId: number | null;
  name: string;
  description: string;
};

export type RestAction = ActionBase & {
  kind: "rest";
  method: HttpMethod;
  url: string;
  headers: { id: string; key: string; value: string }[];
  body: string;
  timeoutMs: number;
};

export type SshAction = ActionBase & {
  kind: "ssh";
  /** Target selection. */
  targetMode: TargetMode;
  /** targetMode === "single" */
  host: string;
  /** targetMode === "list": one server per line. */
  hosts: string[];
  /** targetMode === "group": the host group's id (a real column in the gateway). */
  hostGroupId: number | null;
  /**
   * The SSH host key expected of each server, in authorized_keys form.
   *
   * mcp-action refuses to connect to a server whose key it does not know. The reason: it
   * authenticates with a private key and then runs a command, so anyone who can answer in
   * that server's name takes both.
   */
  hostKeys: Record<string, string>;
  /** How a multi-server run behaves. */
  strategy: RunStrategy;
  /** strategy === "parallel": how many connections at once. */
  concurrency: number;
  /** strategy === "rolling": how many servers per round. */
  batchSize: number;
  /** Leave the rest unrun if one server fails. */
  stopOnError: boolean;
  port: number;
  user: string;
  auth: SshAuth;
  /** auth === "key": PEM contents, or a {{input}} reference. */
  /**
   * A new private key, on its way to being stored.
   *
   * Write-only, and it has three states: `undefined` means "untouched" and the stored key
   * is kept — that is what lets the form be saved without retyping a key it has never
   * seen. `""` means "remove it". Anything else replaces it.
   *
   * The gateway seals it through mcp-cipher into the `secrets` table; only
   * `privateKeySecretId` comes back, and the key itself appears in no response.
   */
  privateKey?: string;
  /** The id of the key stored in the gateway. Read-only. */
  privateKeySecretId?: number | null;
  /** auth === "key": set when the key is protected by a passphrase. */
  passphrase?: string;
  passphraseSecretId?: number | null;
  /** auth === "password": the password, or a {{input}} reference. */
  password?: string;
  passwordSecretId?: number | null;
  /** How the command is arrived at. */
  commandMode: CommandMode;
  /** commandMode === "static" */
  command: string;
  /** commandMode === "dynamic": the command prefixes that are allowed. */
  allowedCommands: string[];
  /** commandMode === "dynamic": patterns that never pass, under any circumstances. */
  blockedPatterns: string[];
  /** commandMode === "dynamic": the rules to follow when writing a command. */
  commandGuidance: string;
  /**
   * commandMode === "dynamic": have a person say yes before it runs.
   *
   * The plan is made and the command is shown; nothing reaches the queue. Approving in the
   * console re-plans the same sentence, compares it with the command that was shown, and
   * runs it only if the two match.
   */
  requireApproval: boolean;
  workingDir: string;
  sudo: boolean;
  /**
   * Stream the command's output while it runs.
   *
   * Off, the behaviour is exactly what it was: the output arrives in one piece when the
   * job ends. This is for commands that do not end on their own — `tail -f`, a long
   * install — where the whole value is in seeing the lines as they come.
   */
  follow: boolean;
  /**
   * How many seconds of silence end the follow.
   *
   * Idle time, not total: a log is watched until it goes quiet, not for a fixed stretch. A
   * flat minute cuts a busy log off mid-sentence and spends the whole minute on a quiet
   * one. Every line that arrives starts the clock again.
   *
   * There is a separate ceiling for a log that never stops writing. It lives in the
   * planner and is not set from the panel — it bounds what the executor can carry, which
   * is not one definition's decision to make.
   */
  followIdleSeconds: number;
};

export type DbAction = ActionBase & {
  kind: "db";
  engine: DbEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  queryMode: DbQueryMode;
  /** queryMode === "static" */
  query: string;
  /** queryMode === "dynamic": a schema summary for the model, written by the operator. */
  schemaHint: string;
  /**
   * The tables whose schema is read and described to the model.
   *
   * An allow list, not a filter. A real schema has hundreds of tables and will not fit in
   * a prompt; a model shown all of them picks the wrong one more often than it finds the
   * right one.
   */
  schemaTables: string[];
  /** The schema as the database itself reports it. Read-only; filled by "Read schema". */
  generatedSchema?: string | null;
  generatedSchemaAt?: string | null;
  /** queryMode === "dynamic": further rules to follow when writing a query. */
  guidance: string;
  /** queryMode === "dynamic": the statement types a written query may use. */
  allowedOperations: SqlOperation[];
  /** queryMode === "dynamic": the ceiling on returned rows. */
  maxRows: number;
  /** queryMode === "dynamic": ask a person before it runs. */
  requireApproval: boolean;
  readOnly: boolean;

  /**
   * The database password, on its way to being stored.
   *
   * Write-only and three-valued, as on the SSH side: `undefined` means untouched and the
   * stored password is kept, `""` removes it, anything else replaces it. The gateway seals
   * it through mcp-cipher; only the id stays in the document.
   */
  password?: string;
  /** The id of the password stored in the gateway. Read-only. */
  passwordSecretId?: number | null;
};

export type Action = RestAction | SshAction | DbAction;

export type Definition = {
  /** Assigned by the gateway; 0 means not saved yet. */
  id: number;
  name: string;
  /**
   * A definition is one tool as the MCP server exposes it. `toolName` is the identifier
   * the calling model sees; `toolDescription` is what tells it what the tool is for.
   */
  toolName: string;
  toolDescription: string;
  /** Which AI model this definition runs with. */
  modelId: number | null;
  systemPrompt: string;
  actions: Action[];
  inputs: DynamicInput[];
  enabled: boolean;
  updatedAt: string;
};

/* --------------------------------------------------------------------------
   Factories
-------------------------------------------------------------------------- */

let counter = 0;

/** Non-colliding ids, generated the same way on the server and in the browser. */
export function newId(prefix = "id") {
  counter += 1;
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}${counter}`;
}

/**
 * A blank action of the given kind.
 *
 * `name` is passed in rather than looked up here, because this module has no locale and the
 * name is data: it is saved with the action and survives a change of interface language.
 * The fallbacks are English and are only reached where the name is replaced immediately —
 * rebuilding an action from what the gateway stored, and in tests.
 */
export function createAction(kind: ActionKind, name?: string): Action {
  const base = { id: newId("act"), actionId: null, description: "" };

  if (kind === "rest") {
    return {
      ...base,
      kind: "rest",
      name: name ?? "New REST request",
      method: "POST",
      url: "https://",
      headers: [{ id: newId("hdr"), key: "Content-Type", value: "application/json" }],
      body: "{\n  \n}",
      timeoutMs: 10000,
    };
  }

  if (kind === "ssh") {
    return {
      ...base,
      kind: "ssh",
      name: name ?? "New SSH command",
      targetMode: "single",
      host: "",
      hosts: [],
      hostGroupId: null,
      hostKeys: {},
      strategy: "sequential",
      concurrency: 4,
      batchSize: 2,
      stopOnError: true,
      port: 22,
      user: "root",
      auth: "key",
      privateKeySecretId: null,
      passphraseSecretId: null,
      passwordSecretId: null,
      commandMode: "static",
      command: "",
      allowedCommands: ["systemctl status", "journalctl", "df -h", "uptime"],
      blockedPatterns: ["rm -rf", "mkfs", "shutdown", "reboot", "dd if="],
      commandGuidance: "",
      requireApproval: true,
      workingDir: "/",
      sudo: false,
      follow: false,
      followIdleSeconds: 60,
    };
  }

  return {
    ...base,
    kind: "db",
    name: name ?? "New query",
    engine: "postgres",
    host: "",
    port: 5432,
    database: "",
    user: "",
    queryMode: "static",
    query: "",
    schemaHint: "",
    schemaTables: [],
    generatedSchema: null,
    generatedSchemaAt: null,
    guidance: "",
    allowedOperations: ["select"],
    maxRows: 100,
    requireApproval: true,
    readOnly: true,
    passwordSecretId: null,
  };
}

export function createInput(): DynamicInput {
  return {
    id: newId("inp"),
    key: "",
    label: "",
    type: "text",
    required: false,
    defaultValue: "",
    placeholder: "",
    options: [],
    source: "prompt",
  };
}

export function createDefinition(): Definition {
  return {
    id: 0,
    name: "",
    toolName: "",
    toolDescription: "",
    modelId: null,
    systemPrompt: "",
    actions: [],
    inputs: [],
    enabled: true,
    updatedAt: new Date().toISOString(),
  };
}

/** A sensible default port when the engine changes. */
export const dbDefaultPorts: Record<DbEngine, number> = {
  postgres: 5432,
  mysql: 3306,
  mssql: 1433,
  sqlite: 0,
  mongodb: 27017,
};

/* --------------------------------------------------------------------------
   Template placeholders
-------------------------------------------------------------------------- */

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Fills the {{key}} placeholders in a string from the input values. */
export function resolveTemplate(template: string, inputs: DynamicInput[]) {
  return template.replace(PLACEHOLDER, (match, key: string) => {
    const input = inputs.find((item) => item.key === key);
    if (!input) return match;
    if (input.type === "password") return "••••••••";
    if (input.defaultValue) return input.defaultValue;
    return `<${input.label || key}>`;
  });
}

/** Placeholders a template uses that no input declares. */
export function unknownPlaceholders(
  templates: string[],
  inputs: DynamicInput[],
) {
  const known = new Set(inputs.map((input) => input.key));
  const found = new Set<string>();

  for (const template of templates) {
    for (const match of template.matchAll(PLACEHOLDER)) {
      if (!known.has(match[1])) found.add(match[1]);
    }
  }

  return [...found];
}

/** Derives an MCP tool name from a definition's name: "Apache filo yönetimi" → "apache_filo_yonetimi". */
export function slugifyToolName(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "_$1")
    .slice(0, 64);
}

type JsonSchemaProperty = {
  type: string;
  description?: string;
  enum?: string[];
  format?: string;
  default?: string | number | boolean;
};

export type ToolInputSchema = {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties: false;
};

/**
 * Turns the dynamic inputs into the MCP tool's input schema.
 * The `tools/list` response on the Python side can use this as it stands.
 */
export function toolInputSchema(inputs: DynamicInput[]): ToolInputSchema {
  const properties: Record<string, JsonSchemaProperty> = {};

  for (const input of inputs) {
    if (!input.key) continue;

    const property: JsonSchemaProperty = { type: "string" };

    switch (input.type) {
      case "number":
        property.type = "number";
        break;
      case "boolean":
        property.type = "boolean";
        break;
      case "date":
        property.format = "date";
        break;
      case "password":
        property.format = "password";
        break;
      case "select":
        if (input.options.length > 0) property.enum = [...input.options];
        break;
      // Both of these want a bigger box, and the schema is the only channel that reaches
      // the run screen: without this they arrive there as a plain string, get a one-line
      // field, and a script cannot be pasted into the form at all.
      //
      // It is a rendering hint and nothing more. Whether a value skips the
      // shell-metacharacter scan is decided from the definition's own input type, where
      // `block` and `textarea` are not the same thing — never from the schema, which any
      // caller can write.
      case "textarea":
      case "block":
        property.format = "textarea";
        break;
      default:
        break;
    }

    if (input.label) property.description = input.label;

    // A secret's default is not written into the schema.
    if (input.defaultValue && input.type !== "password") {
      property.default =
        input.type === "number"
          ? Number(input.defaultValue)
          : input.type === "boolean"
            ? input.defaultValue === "true"
            : input.defaultValue;
    }

    properties[input.key] = property;
  }

  return {
    type: "object",
    properties,
    required: inputs.filter((input) => input.required && input.key).map((input) => input.key),
    additionalProperties: false,
  };
}

/** The least a group needs to be resolved. */
export type HostGroupLike = { id: number; hosts: string[] };

/**
 * Works out which servers an action will actually run on.
 * Groups are passed in: the inventory is editable in the browser, so this module must not
 * be tied to a fixed list.
 */
export function resolveTargets(
  action: SshAction,
  groups: HostGroupLike[] = [],
): string[] {
  const mode = action.targetMode ?? "single";

  if (mode === "list") return (action.hosts ?? []).filter(Boolean);
  if (mode === "group") {
    return groups.find((group) => group.id === action.hostGroupId)?.hosts ?? [];
  }
  return action.host ? [action.host] : [];
}

/** Every template field inside an action. */
export function templateFieldsOf(action: Action): string[] {
  if (action.kind === "rest") {
    return [
      action.url,
      action.body,
      ...action.headers.flatMap((header) => [header.key, header.value]),
    ];
  }
  if (action.kind === "ssh") {
    return [
      action.command,
      action.workingDir,
      action.host,
      ...(action.hosts ?? []),
      action.commandGuidance ?? "",
      action.privateKey ?? "",
      action.passphrase ?? "",
      action.password ?? "",
    ];
  }
  return [
    action.query,
    action.schemaHint ?? "",
    action.guidance ?? "",
  ];
}
