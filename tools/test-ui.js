// Prueba de interfaz con Playwright (autocompletar, teclado, invertir, errores, geolocalización).
// Requiere el servidor local corriendo:  python -m http.server 8765
// y Playwright:  npm i playwright && npx playwright install chromium
// (si no está instalado aquí, intenta usar la copia de otro proyecto de Germán).
//   node tools/test-ui.js
const fs = require('fs');
fs.mkdirSync('tools/shots', { recursive: true });
function requirePlaywright() {
  try { return require('playwright'); } catch (e) {}
  return require('C:/Users/user/Documents/Auditorías/Ejecución y plan semanal/Plan y Productividad Semanal/Robot Agenda Ejecutiva/node_modules/playwright');
}
const { chromium } = requirePlaywright();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });

  // 1) Teclear "zoc" en Desde y ver el desplegable
  await page.fill('#from', 'zoc');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tools/shots/pw_ac1.png' });
  const items1 = await page.$$eval('#from-list .ac-item .nm', els => els.map(e => e.textContent));
  console.log('Sugerencias "zoc":', items1);

  // 2) Búsqueda sin acentos: "tlahuac" y con espacio interno "san l"
  await page.fill('#from', 'san l');
  await page.waitForTimeout(150);
  console.log('Sugerencias "san l":', await page.$$eval('#from-list .ac-item .nm', els => els.map(e => e.textContent)));

  // 3) Elegir con teclado: flecha abajo + Enter
  await page.fill('#from', 'pantit');
  await page.waitForTimeout(150);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  console.log('Origen elegido:', await page.inputValue('#from'));

  // 4) Destino escrito completo sin elegir (debe resolverse solo por coincidencia exacta)
  await page.fill('#to', 'zocalo/tenochtitlan');
  await page.click('#btn-calc');
  await page.waitForTimeout(400);
  console.log('Resultado visible:', !(await page.$eval('#results', e => e.hidden)));
  console.log('Hash:', await page.evaluate(() => location.hash));
  console.log('Resumen:', await page.$eval('#results .summary', e => e.innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: 'tools/shots/pw_result.png', fullPage: true });

  // 5) Invertir
  await page.click('#btn-swap');
  await page.waitForTimeout(300);
  console.log('Tras invertir:', await page.inputValue('#from'), '->', await page.inputValue('#to'), '|', await page.$eval('#results .od', e => e.innerText));

  // 6) Error: mismo origen y destino
  await page.fill('#from', 'Pantitlán'); await page.fill('#to', 'Pantitlán'); await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  console.log('Error mostrado:', await page.$eval('#form-err', e => e.hidden ? '(oculto)' : e.innerText));

  // 7) Error: campo vacío
  await page.click('.clear[data-clear="to"]');
  await page.click('#btn-calc');
  console.log('Error campo vacío:', await page.$eval('#form-err', e => e.hidden ? '(oculto)' : e.innerText));

  // 8) Geolocalización simulada: cerca de Polanco (19.4335, -99.1919)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 19.4335, longitude: -99.1919 }, permissions: ['geolocation'] });
  const p2 = await ctx.newPage();
  await p2.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await p2.click('#btn-geo');
  await p2.waitForSelector('#geo-msg:not([hidden])');
  console.log('Geo:', await p2.$eval('#geo-msg', e => e.innerText), '| origen =', await p2.inputValue('#from'));
  await p2.screenshot({ path: 'tools/shots/pw_geo.png' });

  console.log('Console/errores de página:', logs.length ? logs : 'ninguno');
  await browser.close();
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
