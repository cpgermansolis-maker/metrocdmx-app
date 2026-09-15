// Prueba de interfaz de las funciones A (alternativas), B (hora de llegada) y C (módulo de autobús).
// Requiere el servidor local:  python -m http.server 8765      →  node tools/test-ui-abc.js
const fs = require('fs');
fs.mkdirSync('tools/shots', { recursive: true });
function requirePlaywright() {
  try { return require('playwright'); } catch (e) {}
  return require('C:/Users/user/Documents/Auditorías/Ejecución y plan semanal/Plan y Productividad Semanal/Robot Agenda Ejecutiva/node_modules/playwright');
}
const { chromium } = requirePlaywright();
const pad2 = n => String(n).padStart(2, '0');
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? '  → ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:8765/index.html#polanco/san-lazaro', { waitUntil: 'networkidle' });
  await page.waitForSelector('#results:not([hidden])');

  console.log('B) Hora de llegada');
  const now = new Date();
  const eta = await page.$eval('#optimal .eta', e => e.textContent);
  const expect = new Date(now.getTime() + 35 * 60000);
  check('ETA con hora actual (35 min)', eta === '~' + pad2(expect.getHours()) + ':' + pad2(expect.getMinutes()), eta);
  check('"Sales … (ahora)"', (await page.$eval('#optimal .dep', e => e.textContent)).includes('(ahora)'));
  await page.fill('#depart', '08:00');
  await page.waitForTimeout(100);
  check('ETA con salida 08:00', (await page.$eval('#optimal .eta', e => e.textContent)) === '~08:35', await page.$eval('#optimal .eta', e => e.textContent));
  check('"Sales 08:00"', (await page.$eval('#optimal .dep', e => e.textContent)) === '08:00');

  console.log('A) Alternativas');
  check('Pregunta visible', (await page.$eval('#ask', e => e.innerText)).includes('¿Te acomoda esta ruta?'));
  await page.click('#btn-alts');
  await page.waitForSelector('#alts .card');
  const tags = await page.$$eval('#alts .tag.alt', els => els.map(e => e.textContent));
  const variants = await page.$$eval('#alts .variant', els => els.map(e => e.textContent));
  check('2 alternativas', tags.length === 2, JSON.stringify(tags));
  check('Etiquetas +X min', tags[0].includes('+6 min vs óptima') && tags[1].includes('+7 min vs óptima'), JSON.stringify(variants));
  check('Transbordos en cada alternativa', JSON.stringify(await page.$$eval('#alts .stat:nth-child(2) .val', els => els.map(e => e.textContent))) === '["3","2"]');
  check('Cada alternativa trae mapa y tira', (await page.$$('#alts .block svg')).length === 4);
  check('ETA de alternativas con salida 08:00', JSON.stringify(await page.$$eval('#alts .eta', els => els.map(e => e.textContent))) === '["~08:41","~08:42"]');
  await page.fill('#depart', '09:10');
  check('ETAs se actualizan al cambiar la hora', JSON.stringify(await page.$$eval('.eta', els => els.map(e => e.textContent))) === '["~09:45","~09:51","~09:52"]');
  await page.screenshot({ path: 'tools/shots/abc_alternativas.png', fullPage: true });

  // Ruta sin alternativas razonables
  await page.goto('http://127.0.0.1:8765/index.html#zocalo-tenochtitlan/bellas-artes');   // solo cambia el hash → hashchange
  await page.waitForSelector('#btn-alts');
  check('hashchange recalcula la ruta', (await page.$eval('#optimal .od', e => e.innerText)).includes('Bellas Artes'));
  await page.click('#btn-alts');
  check('Mensaje "sin alternativas"', (await page.$eval('#alts', e => e.innerText)).includes('No encontré alternativas'));
  // Botón "Sí, con esta voy"
  await page.goto('http://127.0.0.1:8765/index.html#polanco/chabacano');
  await page.waitForSelector('#btn-yes');
  await page.click('#btn-yes');
  check('"Sí, con esta voy" cierra la pregunta', (await page.$eval('#ask', e => e.innerText)).includes('Buen viaje'));

  console.log('C) Módulo Santa Ana');
  await page.click('.col-head[data-toggle="satana"]');
  await page.waitForTimeout(600);
  const dayDefault = await page.inputValue('#sa-dia');
  const wd = new Date().getDay();
  check('Día preseleccionado según hoy', dayDefault === (wd === 0 ? 'do' : wd === 5 ? 'vi' : 'ls'), dayDefault);
  await page.selectOption('#sa-dia', 'ls');
  await page.fill('#sa-origen', 'Polanco');
  await page.fill('#sa-hora', '17:00');
  await page.click('#sa-calc');
  await page.waitForSelector('#sa-result.show');
  const vals = await page.$$eval('#sa-result .rr-val', els => els.map(e => e.textContent));
  check('Polanco → TAPO 17:00 (L–S): sal 12:53 (13:45 − 35 − 12 − 5) · TAPO 13:45 · bus 14:00 · llegas 17:00', JSON.stringify(vals) === '["12:53","13:45","14:00","17:00"]', JSON.stringify(vals));
  const sub0 = await page.$eval('#sa-result .rr-sub', e => e.innerText);
  check('Desglose: 35 de Metro + 12 de margen + 5 caminando = 52', sub0.includes('dir. Barranca del Muerto') && sub0.includes('35 min de Metro + 12 de margen + 5 caminando') && sub0.includes('= 52 min'), sub0.replace(/\s+/g, ' '));
  await page.screenshot({ path: 'tools/shots/abc_santa_ana.png', fullPage: true });

  // Desde San Lázaro (ya estás en la terminal): 0 min de metro
  await page.fill('#sa-origen', 'San Lázaro'); await page.click('#sa-calc'); await page.waitForTimeout(150);
  check('Desde San Lázaro: solo 5 min caminando (13:40)', (await page.$$eval('#sa-result .rr-val', els => els.map(e => e.textContent)))[0] === '13:40');
  // Domingo, llegar 08:00: ninguna corrida llega a tiempo; toma la de 07:00 (llega 10:00) y avisa
  await page.fill('#sa-origen', 'Cuatro Caminos'); await page.selectOption('#sa-dia', 'do'); await page.fill('#sa-hora', '08:00'); await page.click('#sa-calc'); await page.waitForTimeout(150);
  const alertTxt = await page.$eval('#sa-result', e => e.innerText);
  check('Domingo 08:00: aviso de llegar tarde + Metro cerrado', alertTxt.includes('120 min después') && alertTxt.includes('antes de la apertura'), alertTxt.replace(/\s+/g, ' ').slice(0, 120));
  // Botón "Ver esta ruta en el planificador"
  await page.fill('#sa-origen', 'Polanco'); await page.selectOption('#sa-dia', 'ls'); await page.fill('#sa-hora', '17:00'); await page.click('#sa-calc'); await page.waitForTimeout(150);
  await page.click('#sa-ver-ruta'); await page.waitForTimeout(300);
  check('Planificador muestra Polanco → San Lázaro con salida 12:53', (await page.$eval('#optimal .od', e => e.innerText)).includes('San Lázaro') && (await page.inputValue('#depart')) === '12:53' && (await page.$eval('#optimal .eta', e => e.textContent)) === '~13:28');

  console.log('Errores de consola:', logs.length ? logs : 'ninguno');
  if (logs.length) fails++;
  await browser.close();
  console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
