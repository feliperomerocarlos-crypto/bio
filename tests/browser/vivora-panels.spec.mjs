import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const preview = () => readFile('revision/index.html', 'utf8');
const studioUrl = 'http://localhost:4174/studio';

test.use({
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  }
});

for (const width of [390, 1440]) {
  test('paneles de lectura y escena de fondo a ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/__test/revision');
    await expect(page.locator('.bv-particle-story canvas')).toBeVisible();
    for (const view of ['inicio','operaciones','inventario','plantas','directorio','analitica','ayuda','asistente']) {
      const panel = page.locator('#view-' + view + ' .bv-story-workspace .card').first();
      await expect(panel).toBeVisible();
      await expect(panel).toHaveCSS('background-color', 'rgb(13, 27, 20)');
      await expect(panel).toHaveCSS('backdrop-filter', 'none');
    }
    await page.evaluate(() => document.documentElement.dataset.theme = 'light');
    await expect(page.locator('#view-inventario .card.flush')).toHaveCSS('background-color', 'rgb(246, 250, 244)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await expect(page.locator('#vivora-toggle')).toBeHidden();
    await expect(page.locator('#vivora-studio iframe')).toHaveCount(0);
  });
}

test('un avatar configurado se abre en la página, con audio simulado y sin cámara', async ({ page }) => {
  const html = (await preview()).replace('data-vivora-url=""', 'data-vivora-url="' + studioUrl + '"');
  await page.route('**/__test/avatar', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.route(studioUrl, route => route.fulfill({ contentType: 'text/html', body: '<main>Estudio de prueba</main>' }));
  await page.goto('/__test/avatar');
  const toggle = page.locator('#vivora-toggle');
  await expect(page.locator('#vivora-studio iframe')).toHaveCount(0);
  await toggle.click();
  await expect(page.frameLocator('iframe').getByText('Estudio de prueba')).toBeVisible();
  const frame = page.frame({ url: studioUrl });
  const permissions = await frame.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const state = stream.getAudioTracks()[0].readyState;
    stream.getTracks().forEach(track => track.stop());
    return { state, camera: document.featurePolicy.allowsFeature('camera') };
  });
  expect(permissions).toEqual({ state: 'live', camera: false });
  await expect(page.locator('#vivora-studio iframe')).toHaveAttribute('title', /Conversación por voz/);
  await toggle.click();
  await expect(page.locator('#vivora-studio iframe')).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
