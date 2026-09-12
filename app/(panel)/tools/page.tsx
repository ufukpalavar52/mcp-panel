import type { Metadata } from "next";
import ToolsView from "@/components/tools/ToolsView";

export const metadata: Metadata = { title: "Araçlar" };

export default function ToolsPage() {
  return <ToolsView />;
}
