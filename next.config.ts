import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * A self-contained server in .next/standalone, for the container image.
   *
   * Without it the image needs the whole of node_modules — 594 MB of it — to run a
   * build that is a few megabytes. Standalone traces what the server actually imports
   * and copies only that.
   *
   * It changes nothing for `next dev`.
   */
  output: "standalone",
};

export default nextConfig;
