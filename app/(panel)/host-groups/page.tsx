import type { Metadata } from "next";
import HostGroupsView from "@/components/host-groups/HostGroupsView";

export const metadata: Metadata = { title: "Sunucu Grupları" };

export default function HostGroupsPage() {
  return <HostGroupsView />;
}
