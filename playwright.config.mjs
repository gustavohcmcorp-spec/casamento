import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChrome = process.env.PLAYWRIGHT_CHROME_EXECUTABLE ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const executablePath = existsSync(localChrome) ? localChrome : undefined;

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    launchOptions: executablePath ? { executablePath } : undefined
  },
  webServer: {
    command: 'npx http-server . -a 127.0.0.1 -p 4173 -c-1',
    port: 4173,
    reuseExistingServer: true
  }
});
