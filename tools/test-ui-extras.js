// Prueba de los extras del paso 5: favoritas (localStorage), enlace de estado
// del Metro y buscador de estación.
// Requiere el servidor local:  python -m http.server 8765      →  node tools/test-ui-extras.js
const fs = require('fs');
fs.mkdirSync('tools/shots', { recursive: true });
function requirePlaywright() {
  try { return require('playwright'); } catch (e) {}
  return require('C:/Users/user/Documents/Auditorías/Ejecución y plan semanal/Plan y Productividad Semanal/Robot Agenda Ejecutiva/node_modules/playwright');
}
const { chromium } = requirePlaywright();
const BASE = 'http://127.0.0.1:8765/index.html';
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? '  → ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading[hidden]', { state: 'attached' });

  console.log('Favoritas');
  check('Sin favoritas: tarjeta cerrada y texto vacío', !(await page.$eval('#favs', e => e.classList.contains('open'))) && (await page.$eval('#fav-list', e => e.innerText)).includes('Aún no tienes favoritas'));
  await page.goto(BASE + '#polanco/chabacano'); await page.waitForSelector('#btn-fav');
  check('Botón "☆ Guardar como favorita" en la óptima', (await page.$eval('#btn-fav', e => e.textContent)).includes('Guardar como favorita'));
  check('Las alternativas NO llevan botón de favorita', (await page.$$('#alts #btn-fav')).length === 0);
  await page.click('#btn-fav');
  check('Cambia a "★ Guardada en favoritas"', (await page.$eval('#btn-fav', e => e.textContent)).includes('Guardada') && await page.$eval('#btn-fav', e => e.classList.contains('on')));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('metrocdmx-favs')));
  check('localStorage metrocdmx-favs = [{from, to}]', stored.length === 1 && stored[0].from === 'polanco' && stored[0].to === 'chabacano', JSON.stringify(stored));
  check('Sección abierta con contador (1)', await page.$eval('#favs', e => e.classList.contains('open')) && (await page.$eval('#fav-count', e => e.textContent)) === '(1)');
  const itemTxt = await page.$eval('#fav-list .fav-item', e => e.innerText.replace(/\s+/g, ' '));
  check('Item muestra ruta, tiempo y transbordos', itemTxt.includes('Polanco') && itemTxt.includes('Chabacano') && itemTxt.includes('~21 min') && itemTxt.includes('1 transbordo'), itemTxt);
  // Segunda favorita, luego recargar y comprobar persistencia
  await page.goto(BASE + '#tacubaya/pantitlan'); await page.waitForSelector('#btn-fav'); await page.click('#btn-fav');
  await page.goto('about:blank'); await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForSelector('#loading[hidden]', { state: 'attached' });
  check('Persisten tras recargar (2, la más nueva primero)', (await page.$eval('#fav-count', e => e.textContent)) === '(2)' && (await page.$eval('#fav-list .fav-item', e => e.innerText)).includes('Tacubaya'));
  await page.screenshot({ path: 'tools/shots/extras_favoritas.png' });
  // Tocar una favorita carga la ruta
  await page.click('#fav-list .fav-item[data-i="1"] .od');
  await page.waitForSelector('#results:not([hidden])');
  check('Tocar favorita calcula la ruta', (await page.$eval('#optimal .od', e => e.innerText)).includes('Polanco') && (await page.$eval('#btn-fav', e => e.textContent)).includes('Guardada'));
  // Quitar con ×
  await page.click('#fav-list .fav-item[data-i="1"] .del');
  check('× quita la favorita y actualiza botón y contador', (await page.$eval('#fav-count', e => e.textContent)) === '(1)' && (await page.$eval('#btn-fav', e => e.textContent)).includes('Guardar como'));
  await page.click('#fav-list .fav-item[data-i="0"] .del');
  check('Sin favoritas otra vez: estado vacío', (await page.$eval('#fav-list', e => e.innerText)).includes('Aún no tienes') && (await page.evaluate(() => localStorage.getItem('metrocdmx-favs'))) === '[]');

  console.log('Estado del Metro');
  const a = await page.$eval('#status .status-link', e => ({ href: e.href, target: e.target, rel: e.rel, text: e.textContent }));
  check('Enlace a twitter.com/MetroCDMX en pestaña nueva', a.href === 'https://twitter.com/MetroCDMX' && a.target === '_blank' && a.rel.includes('noopener') && a.text.includes('Twitter oficial'), JSON.stringify(a));
  check('Tarjeta con cierres de closures.json (detalle en test-closures-ui.js)', (await page.$eval('#status-body', e => e.innerText)).includes('Sin cierres reportados'));

  console.log('Header compacto: sin parpadeo');
  // Regresión: con el scroll anchoring del navegador activo, un scroll que se
  // detenía entre 60 y 80 px hacía que el header se encogiera y creciera sin
  // parar (cada cambio de alto movía el scroll y volvía a cruzar el umbral).
  await page.goto(BASE + '#polanco/san-lazaro', { waitUntil: 'networkidle' });
  await page.waitForSelector('#results:not([hidden])');
  await page.waitForTimeout(1200);                       // deja terminar el scroll suave a #results
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 70);                         // scroll "de persona" de 70 px
  const hdr = await page.evaluate(async () => {
    const seen = new Set();
    for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 100)); seen.add(`${Math.round(scrollY)}/${document.querySelector('header').classList.contains('compact') ? 'compacto' : 'normal'}`); }
    return [...seen];
  });
  check('Scroll de 70 px: el header se compacta y se queda quieto', hdr.length === 1 && hdr[0] === '70/compacto', hdr.join(' '));

  console.log('Buscador de estación');
  await page.click('.col-head[data-toggle="lookup-card"]');
  await page.waitForTimeout(500);
  await page.fill('#lookup', 'Pantitlán');
  await page.waitForSelector('#lookup-info .st-name');
  const info = await page.$eval('#lookup-info', e => e.innerText.replace(/\s+/g, ' '));
  check('Pantitlán: transbordo de 4 líneas', info.includes('Estación de transbordo · 4 líneas') && (await page.$$('#lookup-info .st-name .lpill')).length === 4);
  check('L1: estación 20 de 20, vecina Zaragoza, fin de línea', info.includes('estación 20 de 20') && info.includes('Zaragoza') && info.includes('Aquí termina la línea'));
  check('L5: estación 1 de 13, vecina Hangares', info.includes('estación 1 de 13') && info.includes('Hangares'));
  check('L9: vecina Puebla', info.includes('Puebla'));
  check('LA: vecina Agrícola Oriental', info.includes('Agrícola Oriental'));
  await page.screenshot({ path: 'tools/shots/extras_buscador.png', fullPage: true });
  await page.fill('#lookup', 'Zócalo/Tenochtitlan');
  await page.waitForFunction(() => document.querySelector('#lookup-info').innerText.includes('Zócalo'));
  const info2 = await page.$eval('#lookup-info', e => e.innerText.replace(/\s+/g, ' '));
  check('Zócalo: paso, L2 13 de 24, vecinas Allende y Pino Suárez', info2.includes('Estación de paso') && info2.includes('estación 13 de 24') && info2.includes('Allende') && info2.includes('Pino Suárez'));
  // Id para closures.json con botón Copiar (así se escribe el archivo desde el teléfono).
  check('Muestra "id para closures.json: zocalo-tenochtitlan"', info2.includes('id para closures.json: zocalo-tenochtitlan'), info2.match(/id para[^📍]*/)?.[0]);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('#lookup-info button[data-copy]');
  await page.waitForFunction(() => document.querySelector('#lookup-info button[data-copy]').textContent === '✓ Copiado', null, { timeout: 1400 });
  check('Copiar → "✓ Copiado" y el portapapeles tiene el id', (await page.evaluate(() => navigator.clipboard.readText())) === 'zocalo-tenochtitlan');
  await page.click('#lookup-info button[data-use="to"]');
  check('"Usar como destino" llena el campo Hasta', (await page.inputValue('#to')) === 'Zócalo/Tenochtitlan');

  console.log('Colapsables');
  await page.click('.col-head[data-toggle="satana"]');
  check('Santa Ana abre con el mecanismo genérico', await page.$eval('#satana', e => e.classList.contains('open')));
  await page.click('.col-head[data-toggle="satana"]');
  check('…y cierra', !(await page.$eval('#satana', e => e.classList.contains('open'))));

  console.log('Errores de consola:', logs.length ? logs : 'ninguno');
  if (logs.length) fails++;
  await browser.close();
  console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
