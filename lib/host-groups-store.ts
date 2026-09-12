"use client";

import { useCallback } from "react";
import { announce } from "@/lib/ui/announce";
import { createResourceStore } from "./api/resource-store";
import { hostGroupsApi } from "./api/endpoints";
import { fromHostGroup, toHostGroup } from "./api/mappers";

/** Host inventory targeted by SSH actions, backed by the gateway. */

export type HostGroup = {
  /** Assigned by the gateway; zero means the group has not been saved yet. */
  id: number;
  name: string;
  description: string;
  hosts: string[];
  /** How many actions target this group; computed by the gateway. */
  usedByCount: number;
};

const store = createResourceStore<HostGroup>(async () =>
  (await hostGroupsApi.list()).map(toHostGroup),
);

export function createHostGroup(): HostGroup {
  return { id: 0, name: "", description: "", hosts: [], usedByCount: 0 };
}

export function useHostGroups() {
  return store.useResource().data;
}

export function useHostGroupsStatus() {
  const { loading, error } = store.useResource();
  return { loading, error, reload: store.reload };
}

export function useHostGroupActions() {
  const save = useCallback(async (group: HostGroup) => {
    const body = fromHostGroup(group);
    const isNew = group.id === 0;

    const saved = await announce(
      async () =>
        isNew
          ? await hostGroupsApi.create(body)
          : await hostGroupsApi.update(group.id, body),
      isNew ? "toast.hostGroup.created" : "toast.hostGroup.updated",
      { name: group.name },
    );

    if (saved) await store.reload();
    return saved;
  }, []);

  const remove = useCallback(async (id: number) => {
    const done = await announce(
      () => hostGroupsApi.remove(id),
      "toast.hostGroup.deleted",
    );
    if (done !== undefined) await store.reload();
  }, []);

  return { save, remove };
}

export const hostGroupsStore = store;
