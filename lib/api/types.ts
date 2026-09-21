/**
 * Response shapes of the gateway.
 *
 * Mirrors the DTO records in `com.mcpgateway.dto.response`. Kept as a hand written
 * mirror rather than generated: the surface is small and the compiler still catches a
 * mismatch the moment a component reads a field that no longer exists.
 */

import type { DynamicInput } from "@/lib/definitions";
import type { Action } from "@/lib/definitions";
import type { Effort, ModelProvider, ModelStatus, ThinkingMode } from "@/lib/models-store";

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type ModelParamsPayload = {
  maxTokens?: number;
  effort?: Effort;
  thinking?: ThinkingMode;
  temperature?: number;
  timeoutMs?: number;
};

export type ModelHealthPayload = {
  status?: ModelStatus;
  latencyMs?: number;
  checkedAt?: string;
  error?: string | null;
};

export type AiModelPayload = {
  id: number;
  name: string;
  provider: ModelProvider;
  modelId: string;
  endpoint: string;
  apiKeySecretId: number | null;
  apiKeySecretName: string | null;
  /** Whether a key is stored. The key itself is never returned. */
  hasApiKey: boolean;
  params: ModelParamsPayload;
  health: ModelHealthPayload;
  enabled: boolean;
  notes: string;
  definitionCount: number;
  updatedAt: string;
};

export type HostGroupPayload = {
  id: number;
  name: string;
  description: string;
  hosts: string[];
  hostCount: number;
  usedByCount: number;
  updatedAt: string;
};

export type ActionPayload = {
  id: number;
  kind: Action["kind"];
  name: string;
  description: string;
  position: number;
  config: Record<string, unknown>;
  hostGroupId: number | null;
  hostGroupName: string | null;
  resolvedTargetCount: number;
};

export type DefinitionPayload = {
  id: number;
  name: string;
  toolName: string;
  toolDescription: string;
  modelId: number | null;
  modelName: string | null;
  modelIdentifier: string | null;
  systemPrompt: string;
  inputs: DynamicInput[];
  actions: ActionPayload[];
  enabled: boolean;
  updatedAt: string;
};

export type DefinitionSummaryPayload = {
  id: number;
  name: string;
  toolName: string;
  toolDescription: string;
  modelIdentifier: string | null;
  actionCountsByKind: Record<string, number>;
  inputCount: number;
  enabled: boolean;
  updatedAt: string;
};

export type ToolPayload = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  definitionId: number;
  modelIdentifier: string | null;
  actionCount: number;
  enabled: boolean;
};

/**
 * One action as the MCP server resolved it.
 *
 * Snake case because these fields are the MCP server's own contract: the gateway passes
 * the plan through untouched rather than remapping it, so a change there surfaces here
 * as a visible mismatch instead of being quietly absorbed by a translation layer.
 */
export type PlannedActionPayload = {
  action_id: number;
  name: string;
  kind: "rest" | "ssh" | "db";
  mode: "static" | "dynamic";
  targets: string[];
  resolved: string;
  authored_by_model: boolean;
  rejected_reasons: string[];
  requires_approval: boolean;
  /**
   * The definition has this action, and the request did not ask for it.
   *
   * Kept in the plan rather than dropped: somebody reading a one-call plan needs to see
   * that the other three were considered and set aside, which is a different fact from
   * their never having existed.
   */
  skipped: boolean;
  skip_reason: string;
};

/**
 * Something observed about a statement that its reader should know.
 *
 * A code and the thing observed, never a sentence: the wording belongs here, where the
 * reader's language is known, and what each code can honestly claim is narrow.
 */
export type PlanWarning = {
  /** `unrequested_filter`, `repeats_earlier` or `request_as_value`. */
  code: string;
  detail: string;
};

export type PlanPayload = {
  tool: string;
  definition_id: number;
  model: string | null;
  status: "planned" | "incomplete" | "rejected";
  actions: PlannedActionPayload[];
  problems: string[];
  /**
   * Worth reading before trusting the answer, but not a reason to refuse the plan.
   *
   * A model writing SQL narrows a result on its own: asked how many accounts there were
   * it filtered on a domain nobody mentioned and answered 0 where the answer was 585.
   * Valid SQL, ran, reported success. Separate from `problems` because the plan stands.
   */
  warnings: PlanWarning[];
  masked_inputs: string[];
};

/**
 * What a tool invocation produced.
 *
 * A plan, never a result: nothing is executed yet. `dispatch.status` says why — `skipped`
 * when no executor is configured, `refused` when the plan itself was not accepted, and
 * `awaiting_approval` when the action asks for a person to say yes to the command first.
 */
export type ExecutionResultPayload = {
  status: "planned" | "incomplete" | "rejected";
  plan: PlanPayload;
  dispatch: {
    status: "skipped" | "queued" | "refused" | "awaiting_approval";
    reason: string;
    run_id: string | null;
    action_run_ids: Record<string, string>;
  };
};

/**
 * What a prompt turned into.
 *
 * `toolName` is null when nothing matched, and `problem` says why — a real answer rather
 * than an error. A request no tool serves is worth reporting plainly; forcing it into the
 * nearest match would be worse, since the nearest match to "is the database up?" might be
 * a tool that restarts it.
 */
/**
 * A console session.
 *
 * `turns` is null in a listing and populated when one is opened: a list is for choosing
 * which conversation to return to, and sending every turn of every one of them would move
 * the whole history to draw a sidebar.
 */
export type ConversationPayload = {
  conversationRef: string;
  title: string;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
  /**
   * The goal loop is deciding a next step for this conversation right now.
   *
   * It is two model calls long — deciding what comes next, then planning it — and the
   * console showed nothing for either: a result, a silence, then an approval card. The
   * loop is the only thing that knows, so the answer comes from there.
   */
  continuing: boolean;
  turns: ConversationTurnPayload[] | null;
};

/**
 * One question and what it turned into.
 *
 * No output here by design — `runRef` names the run that holds it. A second copy of a
 * result set would be a second place personal data lives.
 */
export type ConversationTurnPayload = {
  id: number;
  prompt: string;
  /** The tool the operator pinned, if they pinned one. Null means the model chose. */
  pinnedTool: string | null;
  toolName: string | null;
  executed: boolean;
  status: string | null;
  reasoning: string | null;
  problem: string | null;
  statement: string | null;
  /**
   * Every command on this card, when it carried more than one.
   *
   * Null for the usual single-command turn, and for every turn recorded before a card
   * could hold several — `statement` still holds the first either way.
   */
  statements: string[] | null;
  /** What the model said on its own, when no tool answered. */
  answer: string | null;
  /**
   * What the query narrowed on that nobody asked for.
   *
   * Kept with the turn because a warning is worth more later than at the time: whether a
   * number counted everything is what somebody asks a week afterwards, by which point the
   * live warning had scrolled away.
   */
  warnings: PlanWarning[] | null;
  runRef: string | null;
  failure: string | null;
  /**
   * A step the goal loop wrote and did not run.
   *
   * Derived by the gateway, not assembled here: it means "part of a goal, not executed, no
   * run behind it", and a copy of that rule in the browser is the one that drifts.
   */
  awaitingApproval: boolean;
  /**
   * What was asked, for a step the goal loop wrote. Null for a turn somebody typed.
   *
   * A conversation can hold more than one goal at once: leave a step unapproved, ask for
   * something else, come back and approve it, and the first goal carries on from where it
   * stopped. Without this a card says only "approve this command" and gives no way to tell
   * which of two requests it belongs to.
   */
  goalPrompt: string | null;
  createdAt: string;
};

/** What a prompt turned into, and the conversation it was written into. */
export type PromptResponsePayload = {
  conversationRef: string;
  turnId: number;
  result: PromptResultPayload;
};

export type PromptResultPayload = {
  /**
   * What the model said when no tool was the right thing to call.
   *
   * Kept apart from a plan, and it has to be: this is a model talking, not a system
   * reporting. Shown the same way, a guess about how many accounts there are would read
   * exactly like a count.
   */
  answer: string;
  tool_name: string | null;
  arguments: Record<string, unknown>;
  reasoning: string;
  problem: string | null;
  status: "planned" | "incomplete" | "rejected" | null;
  plan: PlanPayload | null;
  dispatch: ExecutionResultPayload["dispatch"] | null;
};

/** One dispatched action and what became of it. */
export type RunPayload = {
  id: number;
  runRef: string;
  actionRef: string;
  definitionId: number | null;
  toolName: string | null;
  actionName: string | null;
  actorLabel: string;
  /** `execute` for work somebody asked for, `introspect` for a schema read. */
  purpose: string;
  status: "pending" | "awaiting_approval" | "running" | "succeeded" | "failed" | "cancelled";
  error: string | null;
  /** What the run was going to execute, masked as the plan showed it. */
  statement: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  targets: {
    address: string;
    status: "pending" | "running" | "succeeded" | "failed" | "skipped";
    exitCode: number | null;
    durationMs: number | null;
    stdoutExcerpt: string | null;
    stderrExcerpt: string | null;
    /** A query's rows. Null for a command, which prints to stdout instead. */
    rows: Record<string, unknown>[] | null;
  }[];
  /**
   * Every action of this job, when it carried more than one.
   *
   * A job approved whole runs its actions under one reference — "write the script" and
   * "run the script" are one decision. Null for the usual single-action job; the fields
   * above are the first action either way.
   */
  steps: RunPayload[] | null;
  /**
   * Nothing is going to finish this run: it is still running, has been for longer than a
   * dispatch takes, and no executor is consuming the job queue.
   *
   * Not folded into `status`, which stays `running` — the gateway observed no outcome and
   * will not invent one. False whenever the broker could not be asked, so this never
   * accuses anybody out of uncertainty.
   */
  stalled: boolean;
};

export type UserPayload = {
  id: number;
  email: string;
  fullName: string;
  role: "admin" | "developer" | "viewer";
  status: "active" | "invited" | "suspended";
  team: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  /** True while an administrator's chosen password is still in place. */
  mustChangePassword?: boolean;
};

export type ToolCallPayload = {
  id: number;
  toolName: string;
  modelLabel: string;
  actorLabel: string;
  level: "info" | "warn" | "error";
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  message: string;
  createdAt: string;
};

export type DailyCallCountPayload = {
  day: string;
  succeeded: number;
  failed: number;
};

export type ModelUsagePayload = {
  modelLabel: string;
  calls: number;
};

export type AuditEventPayload = {
  id: number;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserPayload;
};

export type InvitationPayload = {
  id: number;
  email: string;
  role: "admin" | "developer" | "viewer";
  token: string;
  expiresAt: string;
};

/**
 * Who may reach a definition.
 *
 * `OPEN` is everybody who can sign in; `RESTRICTED` is the people listed and nobody else.
 * An explicit mode rather than "an empty list means everybody" — with the implicit form,
 * removing the last person would quietly reopen the definition and nothing on the screen
 * would change.
 */
export type DefinitionAccessPayload = {
  access: "OPEN" | "RESTRICTED";
  permissions: {
    userId: number;
    /** Absent when sending; the gateway fills these in on the way back. */
    email?: string;
    fullName?: string;
    canRun: boolean;
    /** Implies `canRun`: somebody who may rewrite the command may run what they wrote. */
    canEdit: boolean;
  }[];
};

