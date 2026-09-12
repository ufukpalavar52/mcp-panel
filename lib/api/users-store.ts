"use client";

import { useCallback } from "react";
import { announce } from "@/lib/ui/announce";
import { createResourceStore } from "./resource-store";
import { usersApi } from "./endpoints";
import type { UserPayload } from "./types";

/** Accounts, backed by the gateway. Admin only; other roles get a 403 on load. */
const store = createResourceStore<UserPayload>(async () =>
  (await usersApi.list()).content,
);

export function useUsers() {
  return store.useResource().data;
}

export function useUsersStatus() {
  const { loading, error } = store.useResource();
  return { loading, error, reload: store.reload };
}

export function useUserActions() {
  const suspend = useCallback(async (id: number) => {
    const updated = await announce(() => usersApi.suspend(id), "toast.user.suspended");
    if (updated) await store.reload();
  }, []);

  const invite = useCallback(
    async (body: { email: string; role: string; teamId?: number | null }) => {
      const invitation = await announce(
        () => usersApi.invite(body),
        "toast.user.invited",
      );
      if (!invitation) return undefined;

      await store.reload();
      // The raw token exists only in this response; the caller must show it now.
      return invitation;
    },
    [],
  );

  return { suspend, invite };
}

export const usersStore = store;
