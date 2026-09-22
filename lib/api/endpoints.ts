"use client";

import { api } from "./client";
import type {
  DefinitionAccessPayload,
  AiModelPayload,
  AuditEventPayload,
  DailyCallCountPayload,
  ModelUsagePayload,
  AuthPayload,
  ConversationPayload,
  DefinitionPayload,
  DefinitionSummaryPayload,
  HostGroupPayload,
  InvitationPayload,
  PageResponse,
  ToolCallPayload,
  ToolPayload,
  ExecutionResultPayload,
  PromptResponsePayload,
  RunPayload,
  UserPayload,
} from "./types";

/**
 * One function per gateway endpoint.
 *
 * Components never build a URL themselves, so a route change is a single edit here.
 */

/* --------------------------------- auth --------------------------------- */

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthPayload>("/api/v1/auth/login", { email, password }, { anonymous: true }),

  /**
   * Turns an invitation into an account, and signs the person in.
   *
   * The only way into this system: open registration was removed. No email and no role —
   * both were decided by whoever sent the invitation and are read off it. A form that took
   * an email would let the invited person make an account for somebody else.
   */
  acceptInvitation: (token: string, fullName: string, password: string) =>
    api.post<AuthPayload>(
      `/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`,
      { fullName, password },
      { anonymous: true },
    ),

  /**
   * Changes your own password.
   *
   * The current one is sent even though the request already carries a session: a screen
   * left open is a session anybody walking past has, and knowing the old password
   * authenticates the person rather than the session.
   */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>("/api/v1/auth/password", { currentPassword, newPassword }),

  /** How many sign-ins of yours are still live. A count; no device and no place. */
  sessions: () => api.get<{ active: number }>("/api/v1/auth/sessions"),

  /**
   * Asks for a reset link.
   *
   * Answers the same whether the address has an account or not, so the screen can only
   * ever say "if that address has an account, a link is on its way". Anything more
   * specific would turn the login page into a way of finding out which addresses exist.
   */
  forgotPassword: (email: string) =>
    api.post<void>("/api/v1/auth/password/forgot", { email }, { anonymous: true }),

  /** Sets a password against a reset link. No current password — not knowing it is why. */
  resetPassword: (token: string, newPassword: string) =>
    api.post<void>(
      `/api/v1/auth/password/reset/${encodeURIComponent(token)}`,
      { newPassword },
      { anonymous: true },
    ),

  logoutEverywhere: () => api.post<void>("/api/v1/auth/logout-all"),

  logout: () => api.post<void>("/api/v1/auth/logout"),

  me: () => api.get<UserPayload>("/api/v1/users/me"),
};

/* ---------------------------- definition access --------------------------- */

export const definitionAccessApi = {
  get: (id: number) =>
    api.get<DefinitionAccessPayload>(`/api/v1/definitions/${id}/access`),

  /** Replaced wholesale, the way a definition's actions are. */
  replace: (id: number, body: DefinitionAccessPayload) =>
    api.put<DefinitionAccessPayload>(`/api/v1/definitions/${id}/access`, body),
};

/* -------------------------------- models -------------------------------- */

export const modelsApi = {
  list: () => api.get<AiModelPayload[]>("/api/v1/models"),
  create: (body: unknown) => api.post<AiModelPayload>("/api/v1/models", body),
  update: (id: number, body: unknown) => api.put<AiModelPayload>(`/api/v1/models/${id}`, body),
  toggle: (id: number) => api.post<AiModelPayload>(`/api/v1/models/${id}/toggle`),
  remove: (id: number) => api.delete<void>(`/api/v1/models/${id}`),
};

/* ------------------------------ host groups ------------------------------ */

export const hostGroupsApi = {
  list: () => api.get<HostGroupPayload[]>("/api/v1/host-groups"),
  create: (body: unknown) => api.post<HostGroupPayload>("/api/v1/host-groups", body),
  update: (id: number, body: unknown) =>
    api.put<HostGroupPayload>(`/api/v1/host-groups/${id}`, body),
  remove: (id: number) => api.delete<void>(`/api/v1/host-groups/${id}`),
};

/* ------------------------------ definitions ------------------------------ */

export const definitionsApi = {
  list: (page = 0, size = 100) =>
    api.get<PageResponse<DefinitionSummaryPayload>>("/api/v1/definitions", { page, size }),
  get: (id: number) => api.get<DefinitionPayload>(`/api/v1/definitions/${id}`),
  create: (body: unknown) => api.post<DefinitionPayload>("/api/v1/definitions", body),
  update: (id: number, body: unknown) =>
    api.put<DefinitionPayload>(`/api/v1/definitions/${id}`, body),
  toggle: (id: number) => api.post<DefinitionPayload>(`/api/v1/definitions/${id}/toggle`),
  duplicate: (id: number) => api.post<DefinitionPayload>(`/api/v1/definitions/${id}/duplicate`),
  remove: (id: number) => api.delete<void>(`/api/v1/definitions/${id}`),

  /**
   * Reads the real structure of a database action's tables.
   *
   * Asynchronous: the answer travels through the executor and is written onto the action,
   * so the caller reloads rather than waiting on this reply.
   */
  introspect: (id: number, actionId: number) =>
    api.post<{ runRef: string }>(
      `/api/v1/definitions/${id}/actions/${actionId}/introspect`,
    ),
};

/* --------------------------------- tools --------------------------------- */

export const toolsApi = {
  list: (publishedOnly = false) =>
    api.get<ToolPayload[]>("/api/v1/tools", { published: publishedOnly }),

  /**
   * Runs a tool, unless one of its actions needs somebody to say yes first.
   *
   * The gateway forwards this to the MCP server, which plans and — for anything not held
   * for approval — dispatches. An action marked as needing approval comes back planned
   * with `dispatch.status === "awaiting_approval"` and nothing running.
   *
   * Approving it is this same call again with `expect` set to the command that was on the
   * screen. Approval is of a command rather than of an intention: planning is not
   * deterministic, so the gateway compares what was agreed to with what is about to run
   * and refuses the pair when they differ.
   */
  execute: (
    toolName: string,
    args: Record<string, unknown>,
    approved?: string[],
  ) =>
    api.post<ExecutionResultPayload>(
      `/api/v1/tools/${encodeURIComponent(toolName)}/execute`,
      {
        arguments: args,
        // Both forms, because a plan can show one command or several and the singular is
        // what the prompt path has always sent. Omitted entirely on a first ask.
        ...(approved?.length === 1 ? { expect: approved[0] } : {}),
        ...(approved && approved.length > 1 ? { expectAll: approved } : {}),
      },
    ),

  /**
   * Routes a sentence to a tool.
   *
   * `execute` defaults to false at the gateway: deciding what a request means and acting
   * on it are different things, and a console that did both at once would make the second
   * invisible.
   */
  prompt: (prompt: string, execute = false, toolName?: string, conversationRef?: string) =>
    api.post<PromptResponsePayload>("/api/v1/tools/prompt", {
      prompt,
      execute,
      // Omitted when the user left it on automatic, so the gateway can tell "no preference"
      // from "this one" without an empty string standing for either.
      ...(toolName ? { toolName } : {}),
      // Omitted on the first question of a session. The gateway answers with the reference
      // it used, which is how the next question lands in the same conversation.
      ...(conversationRef ? { conversationRef } : {}),
    }),

  /**
   * Runs a step the goal loop proposed.
   *
   * The turn id, not the command. What runs is planned again from the sentence — through
   * routing, the planner and the guardrails, exactly as a typed question is. Sending back
   * the command the console is showing would be the one way into the executor that skipped
   * every check.
   */
  approveStep: (turnId: number) =>
    api.post<PromptResponsePayload>(`/api/v1/tools/steps/${turnId}/approve`),

  /**
   * Turns down a step that was waiting for approval.
   *
   * The other half of being asked. Without it the only way past a proposal is to approve
   * it, which makes the question rhetorical.
   */
  declineStep: (turnId: number) =>
    api.post<void>(`/api/v1/tools/steps/${turnId}/decline`),

  /** Republishes the catalogue, for when the MCP server restarted and lost it. */
  publish: () => api.post<{ published: number }>("/api/v1/tools/publish"),
};

/* ----------------------------- conversations ------------------------------ */

/**
 * Console sessions, each belonging to the person who had it.
 *
 * No endpoint takes an owner: the gateway reads it from the caller's token. Anything else
 * would be one missing check away from serving somebody else's questions.
 */
export const conversationsApi = {
  /**
   * A page of sessions, optionally only the ones mentioning something.
   *
   * The gateway searches the questions asked as well as the title: a title is the first
   * thing that was asked, and what somebody looks for later is usually a table or a host
   * named halfway down.
   */
  list: (page = 0, size = 20, search = "") =>
    api.get<PageResponse<ConversationPayload>>("/api/v1/conversations", {
      page,
      size,
      ...(search.trim() ? { search: search.trim() } : {}),
    }),

  get: (conversationRef: string) =>
    api.get<ConversationPayload>(`/api/v1/conversations/${conversationRef}`),

  remove: (conversationRef: string) =>
    api.delete<void>(`/api/v1/conversations/${conversationRef}`),
};

/* ---------------------------------- runs ---------------------------------- */

export const runsApi = {
  list: (page = 0, size = 25) =>
    api.get<PageResponse<RunPayload>>("/api/v1/runs", { page, size }),

  get: (runRef: string) => api.get<RunPayload>(`/api/v1/runs/${runRef}`),

  /**
   * Asks the executors to stop a run.
   *
   * Answers with how many actions the request covers, not with whether they stopped: the
   * outcome arrives the usual way, as a result the gateway records.
   */
  cancel: (runRef: string, reason?: string) =>
    api.post<{ requested: number }>(`/api/v1/runs/${runRef}/cancel`, { reason }),
};

/* --------------------------------- users --------------------------------- */

export const usersApi = {
  list: (page = 0, size = 100, search?: string) =>
    api.get<PageResponse<UserPayload>>("/api/v1/users", { page, size, search }),
  update: (id: number, body: unknown) => api.put<UserPayload>(`/api/v1/users/${id}`, body),
  suspend: (id: number) => api.post<UserPayload>(`/api/v1/users/${id}/suspend`),
  invite: (body: unknown) => api.post<InvitationPayload>("/api/v1/users/invitations", body),

  /**
   * Creates an account outright, with a password the administrator picks.
   *
   * The way in that needs no mail — which is what makes requiring mail for invitations
   * safe, since a misconfigured SMTP host then locks nobody out.
   */
  create: (body: { fullName: string; email: string; role: string; password: string }) =>
    api.post<UserPayload>("/api/v1/users", body),
};

/* ---------------------------------- logs ---------------------------------- */

export const logsApi = {
  search: (params: { level?: string; tool?: string; search?: string; page?: number; size?: number }) =>
    api.get<PageResponse<ToolCallPayload>>("/api/v1/logs", {
      level: params.level,
      tool: params.tool,
      search: params.search,
      page: params.page ?? 0,
      size: params.size ?? 25,
    }),

  counts: () => api.get<Record<string, number>>("/api/v1/logs/counts"),

  timeseries: (days = 14) =>
    api.get<DailyCallCountPayload[]>("/api/v1/logs/timeseries", { days }),

  byModel: () => api.get<ModelUsagePayload[]>("/api/v1/logs/by-model"),
};

/* --------------------------------- audit --------------------------------- */

export const auditApi = {
  recent: (limit = 10) =>
    api.get<AuditEventPayload[]>("/api/v1/audit", { limit }),
};
