"use client";

import { createResourceStore } from "./resource-store";
import { toolsApi } from "./endpoints";
import type { ToolPayload } from "./types";

/**
 * The MCP tool catalogue as the gateway publishes it.
 *
 * Derived server side from definitions, JSON Schema included, so the panel shows exactly
 * what the Python MCP server will answer `tools/list` with rather than a second
 * client side reconstruction that could disagree with it.
 */
const store = createResourceStore<ToolPayload>(() => toolsApi.list(false));

export function useTools() {
  return store.useResource().data;
}

export function useToolsStatus() {
  const { loading, error } = store.useResource();
  return { loading, error, reload: store.reload };
}

export const toolsStore = store;
