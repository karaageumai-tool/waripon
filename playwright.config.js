import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4175', headless: true },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175/waripon/',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://supabase.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
      VITE_RECEIPTS_API_URL: 'https://receipts.test',
    },
  },
})
