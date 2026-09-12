import type { Metadata } from "next";
import LogsView from "@/components/logs/LogsView";

export const metadata: Metadata = { title: "Kayıtlar" };

export default function LogsPage() {
  return <LogsView />;
}
