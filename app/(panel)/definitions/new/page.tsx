import type { Metadata } from "next";
import DefinitionCreateView from "@/components/definitions/DefinitionCreateView";

export const metadata: Metadata = { title: "Yeni tanım" };

export default function NewDefinitionPage() {
  return <DefinitionCreateView />;
}
