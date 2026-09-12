import type { Metadata } from "next";
import DefinitionsView from "@/components/definitions/DefinitionsView";

export const metadata: Metadata = { title: "Tanımlar" };

export default function DefinitionsPage() {
  return <DefinitionsView />;
}
