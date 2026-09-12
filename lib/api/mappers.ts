"use client";

import type {
  ActionPayload,
  AiModelPayload,
  DefinitionPayload,
  HostGroupPayload,
} from "./types";
import type { Action, Definition, DynamicInput } from "@/lib/definitions";
import { createAction, createInput, newId } from "@/lib/definitions";
import type { AiModel } from "@/lib/models-store";
import type { HostGroup } from "@/lib/host-groups-store";

/**
 * Payload to panel model translation.
 *
 * Two shapes differ on purpose. The gateway stores what is durable; the editor also
 * needs keys for list rendering, which the server neither stores nor cares about. Those
 * are synthesised here and dropped again on the way out.
 */

export function toAiModel(payload: AiModelPayload): AiModel {
  return {
    id: payload.id,
    name: payload.name,
    provider: payload.provider,
    modelId: payload.modelId,
    endpoint: payload.endpoint,
    apiKeySecretId: payload.apiKeySecretId,
    apiKeySecretName: payload.apiKeySecretName,
    hasApiKey: payload.hasApiKey,
    maxTokens: payload.params.maxTokens ?? 16000,
    effort: payload.params.effort ?? "high",
    thinking: payload.params.thinking ?? "adaptive",
    temperature: payload.params.temperature ?? 1,
    timeoutMs: payload.params.timeoutMs ?? 600000,
    enabled: payload.enabled,
    status: payload.health.status ?? "unchecked",
    latencyMs: payload.health.latencyMs ?? 0,
    lastCheckedAt: payload.health.checkedAt ?? "",
    notes: payload.notes,
    definitionCount: payload.definitionCount,
  };
}

/** Request body for creating or updating a model. */
export function fromAiModel(model: AiModel) {
  const anthropic = model.provider === "anthropic";

  return {
    name: model.name,
    provider: model.provider,
    modelId: model.modelId,
    endpoint: model.endpoint,
    apiKeySecretId: model.apiKeySecretId,
    // Omitted entirely when the field was not touched. Sending `null` or `""` would tell
    // the gateway to unbind the key, so an untouched form would quietly delete it.
    ...(model.apiKey === undefined ? {} : { apiKey: model.apiKey }),
    params: {
      maxTokens: model.maxTokens,
      timeoutMs: model.timeoutMs,
      // Anthropic rejects sampling parameters, every other provider rejects effort;
      // the gateway enforces this too, but sending the wrong one is a wasted round trip.
      ...(anthropic
        ? { effort: model.effort, thinking: model.thinking }
        : { temperature: model.temperature }),
    },
    enabled: model.enabled,
    notes: model.notes,
  };
}

export function toHostGroup(payload: HostGroupPayload): HostGroup {
  return {
    id: payload.id,
    name: payload.name,
    description: payload.description,
    hosts: payload.hosts,
    usedByCount: payload.usedByCount,
  };
}

export function fromHostGroup(group: HostGroup) {
  return {
    name: group.name,
    description: group.description,
    hosts: group.hosts,
  };
}

/** Gives every input a client side key so list rendering has a stable identity. */
function toInput(input: Omit<DynamicInput, "id">): DynamicInput {
  return { ...createInput(), ...withoutNulls(input), id: newId("inp") };
}

/**
 * Rebuilds an action from the gateway's stored config document.
 *
 * Layered over {@link createAction} rather than spread on its own. The gateway keeps an
 * action's settings in one JSONB document whose Java fields are nullable, so anything the
 * action never set comes back as `null` — a database action carries no `privateKey`, an
 * SSH action carries no `engine`. Spreading that straight onto an `Action` put nulls into
 * fields the type declares as strings and numbers, which React then reported one input at
 * a time: *`value` prop on `input` should not be null*.
 *
 * Starting from the defaults means every field is defined whatever the document omits, and
 * the `as Action` below stops being a claim the runtime can contradict.
 */
function toAction(payload: ActionPayload): Action {
  const config = withoutNulls(payload.config as Record<string, unknown>);

  // Headers come back as {key, value} and the editor keys its rows by id. Spreading the
  // stored config over the blank action replaced the ids with nothing, so every row
  // rendered with an undefined key — React's "each child should have a unique key",
  // and rows that lose their identity when one is removed.
  if (Array.isArray(config.headers)) {
    config.headers = config.headers.map((header) => ({
      ...(header as Record<string, unknown>),
      id: newId("hdr"),
    }));
  }

  return {
    ...createAction(payload.kind),
    ...config,
    id: newId("act"),
    // Kept, unlike before: the gateway dispatches introspection by this id, and throwing
    // it away sent NaN in the URL.
    actionId: payload.id,
    kind: payload.kind,
    name: payload.name,
    description: payload.description,
    hostGroupId: payload.hostGroupId,
  } as Action;
}

/**
 * Drops keys whose value is `null`, so a default underneath survives.
 *
 * `undefined` is dropped too: it would replace a default with nothing, and an input bound
 * to it flips from controlled to uncontrolled — the same defect wearing a different
 * warning.
 */
function withoutNulls<T extends object>(source: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<T>;
}

export function toDefinition(payload: DefinitionPayload): Definition {
  return {
    id: payload.id,
    name: payload.name,
    toolName: payload.toolName,
    toolDescription: payload.toolDescription,
    modelId: payload.modelId,
    systemPrompt: payload.systemPrompt,
    inputs: payload.inputs.map((input) => toInput(input as Omit<DynamicInput, "id">)),
    actions: payload.actions.map(toAction),
    enabled: payload.enabled,
    updatedAt: payload.updatedAt,
  };
}

/**
 * One write-only credential, present only when the user typed something.
 *
 * Three-valued on purpose: absent keeps what is stored, `""` removes it, anything else
 * replaces it. Collapsing the first two would make saving an unchanged form destructive.
 */
function credential(
  key: "privateKey" | "passphrase" | "password",
  source: Record<string, unknown>,
): Record<string, string> {
  const value = source[key];
  return typeof value === "string" ? { [key]: value } : {};
}

/**
 * Request body for a definition.
 *
 * Client side keys are stripped: the gateway replaces actions and inputs wholesale, so
 * sending an id would only invite it to be trusted.
 */
export function fromDefinition(definition: Definition) {
  return {
    name: definition.name,
    toolName: definition.toolName,
    toolDescription: definition.toolDescription,
    modelId: definition.modelId,
    systemPrompt: definition.systemPrompt,
    inputs: definition.inputs.map((input) => {
      const copy = { ...input } as Partial<DynamicInput>;
      delete copy.id;
      return copy;
    }),
    actions: definition.actions.map((action) => {
      const source = action as Action & { hostGroupId?: number | null };
      const config = { ...source } as Record<string, unknown>;

      // Client only keys and the fields the gateway keeps as real columns.
      for (const key of ["id", "actionId", "kind", "name", "description", "hostGroupId"]) {
        delete config[key];
      }

      // Credentials travel beside the config, never inside it. The config is stored as a
      // JSON document; a plaintext key placed there would be a plaintext key in the
      // database. The gateway seals these and puts only an id back in the document.
      for (const key of ["privateKey", "passphrase", "password"]) {
        delete config[key];
      }

      // A GET carries no body, and the gateway refuses one that does. Dropped here as
      // well as when the method is chosen, because a definition saved before that was
      // true still holds one — and the editor greys the field out, so there is no way to
      // clear it by hand. Without this such a definition can never be saved again.
      if (source.kind === "rest" && config.method === "GET") {
        config.body = "";
      }

      return {
        kind: source.kind,
        name: source.name,
        description: source.description,
        hostGroupId: source.hostGroupId ?? null,
        // Omitted when untouched. Sending null or "" would tell the gateway to unbind the
        // credential, so simply saving a form again would delete it.
        ...credential("privateKey", source),
        ...credential("passphrase", source),
        ...credential("password", source),
        config,
      };
    }),
    enabled: definition.enabled,
  };
}
