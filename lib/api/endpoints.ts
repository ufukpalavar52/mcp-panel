"use client";

import { api } from "./client";
import type {
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

  register: (fullName: string, email: string, password: string) =>
    api.post<AuthPayload>(
      "/api/v1/auth/register",
      { fullName, email, password, acceptTerms: true },
      { anonymous: true },
    ),

  logout: () => api.post<void>("/api/v1/auth/logout"),

  me: () => api.get<UserPayload>("/api/v1/users/me"),
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
   * Asks what a tool call resolves to. Nothing runs.
   *
   * The gateway forwards this to the MCP server, which decides; the answer is a plan
   * describing what *would* happen, and no executor exists to carry it out yet.
   */
  execute: (toolName: string, args: Record<string, unknown>) =>
    api.post<ExecutionResultPayload>(
      `/api/v1/tools/${encodeURIComponent(toolName)}/execute`,
      args,
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
  list: (page = 0, size = 100) =>
    api.get<PageResponse<UserPayload>>("/api/v1/users", { page, size }),
  update: (id: number, body: unknown) => api.put<UserPayload>(`/api/v1/users/${id}`, body),
  suspend: (id: number) => api.post<UserPayload>(`/api/v1/users/${id}/suspend`),
  invite: (body: unknown) => api.post<InvitationPayload>("/api/v1/users/invitations", body),
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
