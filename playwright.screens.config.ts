import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5173';

/** Visual QA harness only — run with `pnpm e2e:screens`. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/screens.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev:web',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
