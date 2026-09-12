import type { MessageKey } from "./i18n/tr";

/**
 * Presentation lookups for values the gateway returns as enums.
 *
 * The rows themselves come from the API; only the colour and label mapping lives on the
 * client, because how a role is painted is a panel decision, not a backend one.
 */

export type UserRole = "admin" | "developer" | "viewer";
export type UserStatus = "active" | "invited" | "suspended";

export const userRoleKeys: Record<UserRole, MessageKey> = {
  admin: "users.role.admin",
  developer: "users.role.developer",
  viewer: "users.role.viewer",
};

export const userRoleColor: Record<UserRole, string> = {
  admin: "danger",
  developer: "primary",
  viewer: "secondary",
};

export const userStatusKeys: Record<UserStatus, MessageKey> = {
  active: "users.status.active",
  invited: "users.status.invited",
  suspended: "users.status.suspended",
};

export const userStatusColor: Record<UserStatus, string> = {
  active: "success",
  invited: "info",
  suspended: "secondary",
};

export type LogLevel = "info" | "warn" | "error";

export const logLevelColor: Record<LogLevel, string> = {
  info: "info",
  warn: "warning",
  error: "danger",
};
