import type { Metadata } from "next";
import ConsoleView from "@/components/console/ConsoleView";

export const metadata: Metadata = { title: "Konsol" };

export default function ConsolePage() {
  return <ConsoleView />;
}
