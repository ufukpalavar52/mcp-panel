import type { Metadata } from "next";
import RunsView from "@/components/runs/RunsView";

export const metadata: Metadata = { title: "Çalıştırmalar" };

export default function RunsPage() {
  return <RunsView />;
}
