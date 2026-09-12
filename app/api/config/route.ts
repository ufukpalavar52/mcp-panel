import { NextResponse } from "next/server";
import { loadPanelConfig } from "@/lib/config/remote-config";

/**
 * The browser's view of this panel's configuration.
 *
 * A route handler rather than a value injected into the page, so the pages stay static.
 * Reading configuration in the layout would make every page dynamic, and reading it at
 * build time would bake it into the output — which is what moving it to a config server
 * was meant to stop.
 *
 * Only what the browser needs is returned. The config server is never exposed to it
 * directly: this handler is the boundary, and it decides what crosses.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await loadPanelConfig();

  return NextResponse.json(config, {
    // Read fresh on every load. The document is small and local, and a cached copy would
    // reintroduce the staleness this endpoint exists to remove.
    headers: { "Cache-Control": "no-store" },
  });
}
