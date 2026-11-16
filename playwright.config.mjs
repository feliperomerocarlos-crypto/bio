import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/browser',fullyParallel:false,workers:1,timeout:30000,
  use:{baseURL:'http://127.0.0.1:4173',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}},
  webServer:{command:'node tests/helpers/helpdesk-server.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:false},
  reporter:'list',outputDir:'test-results'
});
