import {
  cilHistory,
  cilLayers,
  cilList,
  cilMemory,
  cilPeople,
  cilPuzzle,
  cilSettings,
  cilSitemap,
  cilSpeedometer,
  cilTerminal,
} from "@coreui/icons";
import type { MessageKey } from "./i18n/tr";

export type NavItem = {
  labelKey: MessageKey;
  href: string;
  icon: string[];
  /**
   * Where the badge number comes from, when the item has one.
   * Resolved by the sidebar at render time; the count is never hard coded here.
   */
  badgeSource?: "logErrors";
};

export type NavSection = {
  titleKey: MessageKey;
  items: NavItem[];
};

export const navigation: NavSection[] = [
  {
    titleKey: "nav.section.general",
    items: [
      { labelKey: "nav.dashboard", href: "/dashboard", icon: cilSpeedometer },
      { labelKey: "nav.console", href: "/console", icon: cilTerminal },
      { labelKey: "nav.models", href: "/models", icon: cilMemory },
      { labelKey: "nav.definitions", href: "/definitions", icon: cilLayers },
      { labelKey: "nav.hostGroups", href: "/host-groups", icon: cilSitemap },
      { labelKey: "nav.tools", href: "/tools", icon: cilPuzzle },
      { labelKey: "nav.runs", href: "/runs", icon: cilHistory },
    ],
  },
  {
    titleKey: "nav.section.admin",
    items: [
      { labelKey: "nav.users", href: "/users", icon: cilPeople },
      { labelKey: "nav.logs", href: "/logs", icon: cilList, badgeSource: "logErrors" },
      { labelKey: "nav.settings", href: "/settings", icon: cilSettings },
    ],
  },
];

const allItems = navigation.flatMap((section) => section.items);

export type Crumb = { labelKey: MessageKey; href?: string };

/** Builds a two-level breadcrumb for a sub-route, such as /definitions/new. */
export function resolveBreadcrumb(pathname: string): Crumb[] {
  const parent = allItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  if (!parent) return [];
  if (pathname === parent.href) return [{ labelKey: parent.labelKey }];

  const segment = pathname.slice(parent.href.length + 1).split("/")[0];

  return [
    { labelKey: parent.labelKey, href: parent.href },
    { labelKey: segment === "new" ? "header.new" : "header.edit" },
  ];
}
