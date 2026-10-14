import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// The journey specs talk to Supabase directly (test owner, cleanup) with the same keys as the app.
loadEnvConfig(process.cwd());

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Deterministic runs: no home intro, no page transitions, no marquee drift.
    // tests/e2e/motion.spec.ts turns motion back on to cover the transitions.
    reducedMotion: "reduce",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // A production build: what Vercel runs. NEXT_PUBLIC_* values are inlined at build time.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SITE_URL: baseURL,
      // A full card in one visit; the cooldown rule itself is covered by unit tests.
      STAMP_COOLDOWN_MINUTES: "0",
      // The service admin of the E2E run (tests/e2e/admin.spec.ts).
      ADMIN_EMAILS: "e2e-admin@example.com",
    },
  },
});
