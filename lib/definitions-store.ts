"use client";

import { useCallback, useEffect, useState } from "react";
import { announce } from "@/lib/ui/announce";
import { createResourceStore } from "./api/resource-store";
import { definitionsApi } from "./api/endpoints";
import { fromDefinition, toDefinition } from "./api/mappers";
import type { Definition } from "./definitions";
import type { DefinitionSummaryPayload } from "./api/types";

/**
 * Definitions, backed by the gateway.
 *
 * The list endpoint returns summaries and the detail endpoint returns the full document
 * with its actions. The list store therefore holds summaries, and a single definition is
 * fetched on demand by the editor — loading every action of every definition to render a
 * table would be wasteful and would grow with the catalogue.
 */

export type DefinitionSummary = {
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

function toSummary(payload: DefinitionSummaryPayload): DefinitionSummary {
  return {
    id: payload.id,
    name: payload.name,
    toolName: payload.toolName,
    toolDescription: payload.toolDescription,
    modelIdentifier: payload.modelIdentifier,
    actionCountsByKind: payload.actionCountsByKind,
    inputCount: payload.inputCount,
    enabled: payload.enabled,
    updatedAt: payload.updatedAt,
  };
}

const store = createResourceStore<DefinitionSummary>(async () =>
  (await definitionsApi.list()).content.map(toSummary),
);

export function useDefinitions() {
  return store.useResource().data;
}

export function useDefinitionsStatus() {
  const { loading, error } = store.useResource();
  return { loading, error, reload: store.reload };
}

/** Fetches one full definition, including its actions. */
export function useDefinition(id: number) {
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    definitionsApi
      .get(id)
      .then((payload) => {
        if (!cancelled) {
          setDefinition(toDefinition(payload));
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        // A cancelled effect must not write state; the editor may already be unmounted.
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Bilinmeyen hata");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { definition, loading, error };
}

/**
 * Mutations, each of which reports its outcome to the user.
 *
 * Announced here rather than at the call sites: this is where an operation's meaning is
 * known, and there are many more buttons than there are operations. `announce` does not
 * rethrow, so a failed call returns `undefined` — a caller that navigates away on success
 * has to check, and the ones that do not stay fire and forget without producing unhandled
 * rejections.
 */
export function useDefinitionActions() {
  const save = useCallback(async (definition: Definition) => {
    const body = fromDefinition(definition);
    const isNew = definition.id === 0;

    const saved = await announce(
      async () =>
        isNew
          ? await definitionsApi.create(body)
          : await definitionsApi.update(definition.id, body),
      isNew ? "toast.definition.created" : "toast.definition.updated",
      { name: definition.name },
    );

    if (!saved) return undefined;

    await store.reload();
    return toDefinition(saved);
  }, []);

  const remove = useCallback(async (id: number) => {
    const done = await announce(
      () => definitionsApi.remove(id),
      "toast.definition.deleted",
    );
    if (done !== undefined) await store.reload();
  }, []);

  const toggle = useCallback(async (id: number) => {
    const updated = await announce(
      () => definitionsApi.toggle(id),
      "toast.definition.toggled",
    );
    if (updated) await store.reload();
  }, []);

  const duplicate = useCallback(async (id: number) => {
    const copy = await announce(
      () => definitionsApi.duplicate(id),
      "toast.definition.duplicated",
    );
    if (copy) await store.reload();
  }, []);

  return { save, remove, toggle, duplicate };
}

export const definitionsStore = store;
