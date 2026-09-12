import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmounted between tests, so a component that keeps a timer running cannot influence the
// next one — RunOutcome polls, and a leaked poll would make an unrelated test flaky.
afterEach(() => {
  cleanup();
});
