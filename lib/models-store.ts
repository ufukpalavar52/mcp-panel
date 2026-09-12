"use client";

import { useCallback } from "react";
import { announce } from "@/lib/ui/announce";
import type { MessageKey } from "./i18n/tr";
import { createResourceStore } from "./api/resource-store";
import { modelsApi } from "./api/endpoints";
import { fromAiModel, toAiModel } from "./api/mappers";

/**
 * AI model registry, backed by the gateway.
 *
 * The panel keeps a flat view model while the gateway splits request parameters and
 * health into JSON columns; the mapping between the two lives in `api/mappers.ts`.
 */

export type ModelProvider =
  | "anthropic"
  | "openai_compatible"
  | "azure"
  | "vertex"
  | "bedrock"
  | "ollama"
  | "custom";

export const providerKeys: Record<ModelProvider, MessageKey> = {
  anthropic: "models.provider.anthropic",
  "openai_compatible": "models.provider.openai_compatible",
  azure: "models.provider.azure",
  vertex: "models.provider.vertex",
  bedrock: "models.provider.bedrock",
  ollama: "models.provider.ollama",
  custom: "models.provider.custom",
};

export const providerColors: Record<ModelProvider, string> = {
  anthropic: "primary",
  "openai_compatible": "info",
  azure: "info",
  vertex: "warning",
  bedrock: "warning",
  ollama: "secondary",
  custom: "secondary",
};

/**
 * Suggested endpoint filled in when a provider is picked.
 *
 * The OpenAI compatible ones end in `/v1` because that is the path the MCP server's
 * client appends nothing to: a base URL without it reaches the host but not the API, and
 * the resulting 404 says nothing about the missing segment.
 */
export const providerDefaultEndpoints: Record<ModelProvider, string> = {
  anthropic: "https://api.anthropic.com",
  openai_compatible: "https://api.openai.com/v1",
  azure: "",
  vertex: "",
  bedrock: "",
  ollama: "http://localhost:11434/v1",
  custom: "",
};

/**
 * Claude 4.6 and later removed sampling parameters; sending `temperature` returns a 400.
 * Depth is expressed with `effort` instead, so the form shows a different field set.
 */
export function usesEffort(provider: ModelProvider) {
  return provider === "anthropic";
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const effortKeys: Record<Effort, MessageKey> = {
  low: "models.effort.low",
  medium: "models.effort.medium",
  high: "models.effort.high",
  xhigh: "models.effort.xhigh",
  max: "models.effort.max",
};

export type ThinkingMode = "adaptive" | "disabled";

export type ModelStatus = "online" | "degraded" | "offline" | "unchecked";

export const modelStatusMeta: Record<ModelStatus, { key: MessageKey; color: string }> = {
  online: { key: "models.status.online", color: "success" },
  degraded: { key: "models.status.degraded", color: "warning" },
  offline: { key: "models.status.offline", color: "danger" },
  unchecked: { key: "models.status.unchecked", color: "secondary" },
};

export type AiModel = {
  /** Assigned by the gateway; zero means the record has not been saved yet. */
  id: number;
  name: string;
  provider: ModelProvider;
  modelId: string;
  endpoint: string;
  /** Reference to the stored secret holding the API key. */
  apiKeySecretId: number | null;
  apiKeySecretName: string | null;
  /** Whether the gateway holds a key. Read only; the key itself never comes back. */
  hasApiKey: boolean;
  /**
   * A key the user has just typed, on its way to the gateway.
   *
   * Write only, and deliberately three-valued. `undefined` means "not touched", and the
   * stored key is kept — which is what lets the form be saved again without retyping a key
   * it was never given. `""` means "remove it". Anything else replaces it.
   */
  apiKey?: string;
  maxTokens: number;
  effort: Effort;
  thinking: ThinkingMode;
  temperature: number;
  timeoutMs: number;
  enabled: boolean;
  status: ModelStatus;
  latencyMs: number;
  lastCheckedAt: string;
  notes: string;
  /** How many definitions use this model; computed by the gateway. */
  definitionCount: number;
};

const store = createResourceStore<AiModel>(async () =>
  (await modelsApi.list()).map(toAiModel),
);

export function createModel(): AiModel {
  return {
    id: 0,
    name: "",
    provider: "anthropic",
    modelId: "claude-opus-5",
    endpoint: providerDefaultEndpoints.anthropic,
    apiKeySecretId: null,
    apiKeySecretName: null,
    hasApiKey: false,
    maxTokens: 16000,
    effort: "high",
    thinking: "adaptive",
    temperature: 1,
    timeoutMs: 600000,
    enabled: true,
    status: "unchecked",
    latencyMs: 0,
    lastCheckedAt: "",
    notes: "",
    definitionCount: 0,
  };
}

export function useModels() {
  return store.useResource().data;
}

/** Loading and failure state, for pages that render a spinner or an error banner. */
export function useModelsStatus() {
  const { loading, error } = store.useResource();
  return { loading, error, reload: store.reload };
}

export function useModel(id: number) {
  return useModels().find((model) => model.id === id);
}

export function useModelActions() {
  const save = useCallback(async (model: AiModel) => {
    const body = fromAiModel(model);
    const isNew = model.id === 0;

    const saved = await announce(
      async () =>
        isNew ? await modelsApi.create(body) : await modelsApi.update(model.id, body),
      isNew ? "toast.model.created" : "toast.model.updated",
      { name: model.name },
    );

    if (saved) await store.reload();
    return saved;
  }, []);

  const remove = useCallback(async (id: number) => {
    const done = await announce(() => modelsApi.remove(id), "toast.model.deleted");
    if (done !== undefined) await store.reload();
  }, []);

  const toggle = useCallback(async (id: number) => {
    const updated = await announce(() => modelsApi.toggle(id), "toast.model.toggled");
    if (updated) await store.reload();
  }, []);

  return { save, remove, toggle };
}

export const modelsStore = store;
