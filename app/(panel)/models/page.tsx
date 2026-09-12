import type { Metadata } from "next";
import ModelsView from "@/components/models/ModelsView";

export const metadata: Metadata = { title: "AI Modelleri" };

export default function ModelsPage() {
  return <ModelsView />;
}
