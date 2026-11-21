import { test, expect } from '@playwright/test';

test('dictado en español comparte el chat y permite detener la lectura', async ({page}) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { window.testRecognition = this; }
      abort() { this.onend?.(); }
    };
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', {value: {
      getVoices() { return [
        {name:'Helena', lang:'es-ES', voiceURI:'es-helena'},
        {name:'Pablo', lang:'es-ES', voiceURI:'es-pablo'},
        {name:'Gonzalo', lang:'es-CO', voiceURI:'co-gonzalo'}
      ]; },
      speak(utterance) { window.testSpoken = utterance.text; window.testSpeech = utterance; },
      cancel() { window.testStopped = true; }
    }});
  });
  let requests = 0;
  await page.route('**/api/chat', route => {
    requests++;
    expect(route.request().postDataJSON().message).toBe('¿Qué es biomasa?');
    return route.fulfill({json:{reply:'Es materia orgánica.'}});
  });
  await page.goto('/#asistente');
  await expect(page.locator('.vivora-panel')).toBeHidden();
  await page.getByRole('button',{name:'Hablar',exact:true}).click();
  await page.evaluate(() => {
    const result = Object.assign([{transcript:'¿Qué es biomasa?'}],{isFinal:true});
    window.testRecognition.onresult({resultIndex:0,results:[result]});
  });
  await expect(page.locator('#voiceRead')).toHaveText('Detener lectura');
  expect(await page.evaluate(() => window.testSpoken)).toBe('Es materia orgánica.');
  expect(requests).toBe(1);
  expect(await page.evaluate(() => window.testSpeech.voice.voiceURI)).toBe('co-gonzalo');
  const mouth = page.locator('.chat-head .voice-avatar canvas');
  await expect(mouth).toHaveCount(0);
  await page.evaluate(() => window.testSpeech.onstart());
  await expect(mouth).toBeVisible();
  const pixels = () => mouth.evaluate(canvas => canvas.toDataURL());
  const initial = await pixels();
  await expect.poll(pixels).not.toBe(initial);
  await page.evaluate(() => window.testSpeech.onpause());
  await expect(mouth).toBeHidden();
  await page.evaluate(() => window.testSpeech.onresume());
  await expect(mouth).toBeVisible();
  await page.locator('#voiceRead').click();
  expect(await page.evaluate(() => window.testStopped)).toBe(true);
  await expect(mouth).toBeHidden();
  await page.locator('#assistantVoice').selectOption('es-pablo');
  await page.locator('#voiceRead').click();
  expect(await page.evaluate(() => window.testSpeech.voice.voiceURI)).toBe('es-pablo');
  await page.evaluate(() => { window.testSpeech.onstart(); window.testSpeech.onend({type:'end'}); });
  await expect(mouth).toBeHidden();
  await page.locator('#voiceMic').click();
  await page.evaluate(() => window.testRecognition.onerror({error:'not-allowed'}));
  await expect(page.locator('#voiceStatus')).toContainText('bloqueado');
  await expect(page.locator('#chatInput')).toBeEditable();
});

test('el chat de texto sigue disponible cuando faltan las APIs de voz', async ({page}) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = window.webkitSpeechRecognition = undefined;
    Object.defineProperty(window,'speechSynthesis',{value:undefined});
  });
  await page.route('**/api/chat', route => route.fulfill({json:{reply:'Respuesta de prueba'}}));
  await page.goto('/#asistente');
  await expect(page.locator('#voiceMic')).toBeHidden();
  await expect(page.locator('#voiceRead')).toBeHidden();
  await page.locator('#chatInput').fill('Hola');
  await page.locator('#chatSend').click();
  await expect(page.locator('#chatLog')).toContainText('Respuesta de prueba');
});
