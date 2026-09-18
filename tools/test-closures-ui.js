// Prueba de la tarjeta "Estado del Metro": carga de closures.json con red,
// sin red, con archivo roto, con red lenta y con error del servidor.
// Requiere el servidor local:  python -m http.server 8765      →  node tools/test-closures-ui.js
//
// Se bloquea el service worker en este contexto para poder interceptar
// closures.json con page.route (el SW y su caché se prueban en test-pwa.js).
const fs = require('fs');
fs.mkdirSync('tools/shots', { recursive: true });
function requirePlaywright() {
  try { return require('playwright'); } catch (e) {}
  return require('C:/Users/user/Documents/Auditorías/Ejecución y plan semanal/Plan y Productividad Semanal/Robot Agenda Ejecutiva/node_modules/playwright');
}
const { chromium } = requirePlaywright();
const BASE = 'http://127.0.0.1:8765/index.html';
const KEY = 'metrocdmx-closures';
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? '  → ' + extra : ''}`); if (!ok) fails++; };

const FAKE = {
  updated: '17 de septiembre de 2026, 10:00',
  message: 'L1 sin servicio de Pantitlán a Isabel la Católica por obras',
  stations: ['pantitlan', 'zaragoza', 'gomez-farias', 'zocalo'],   // "zocalo" no existe: error de dedo a propósito
  lines: ['12'],
  transfers: ['chabacano'],
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' && !(m.location().url || '').includes('closures.json')) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  const status = () => page.$eval('#status-body', e => e.innerText.replace(/\s+/g, ' ').trim());
  const stored = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const load = async (hash = '') => { await page.goto(BASE + hash, { waitUntil: 'networkidle' }); await page.waitForSelector('#loading[hidden]', { state: 'attached' }); };
  // Reemplaza la respuesta de closures.json para el resto de la prueba.
  let mode = null;
  await page.route('**/closures.json', route => {
    if (!mode) return route.continue();
    if (mode.abort) return route.abort('internetdisconnected');
    const send = () => route.fulfill({ status: mode.status || 200, contentType: 'application/json', body: mode.body });
    mode.delay ? setTimeout(send, mode.delay) : send();
  });

  console.log('1) closures.json real del repositorio');
  await load();
  let txt = await status();
  check('Muestra "Sin cierres reportados"', txt.includes('Sin cierres reportados'), txt);
  check('Muestra la fecha del archivo ("Cierres al …")', txt.includes('Cierres al 17 de septiembre de 2026'));
  check('Sin avisos de closures.json', !txt.includes('Revisa closures.json'));
  let st = await stored();
  check('Guardó la copia en localStorage { fetchedAt, raw }', st && st.fetchedAt && st.raw && Array.isArray(st.raw.stations), JSON.stringify(st).slice(0, 80));
  check('Enlace a Twitter oficial sigue presente', (await page.$eval('#status .status-link', a => a.href)).includes('twitter.com/MetroCDMX'));
  await (await page.$('#status')).screenshot({ path: 'tools/shots/cierres_sin.png' });

  console.log('2) Cierres simulados (mensaje, estaciones, línea, transbordo, id inválido)');
  mode = { body: JSON.stringify(FAKE) };
  await load();
  txt = await status();
  check('Mensaje visible', txt.includes(FAKE.message));
  check('Línea 12 cerrada', txt.includes('LÍNEAS CERRADAS') && txt.includes('Línea 12'), txt);
  check('Estaciones cerradas con nombre oficial', txt.includes('ESTACIONES CERRADAS') && txt.includes('Pantitlán') && txt.includes('Zaragoza') && txt.includes('Gómez Farías'));
  check('Transbordo cerrado en Chabacano', txt.includes('SIN TRANSBORDO EN') && txt.includes('Chabacano'));
  check('Aviso por id desconocido "zocalo"', txt.includes('Revisa closures.json') && txt.includes('"zocalo"'));
  check('No aparece "Sin cierres reportados"', !txt.includes('Sin cierres reportados'));
  const pills = await page.$$eval('#status-body .lpill', els => els.map(e => e.textContent));
  check('Pastillas de línea: 12 + 1,5,9,A (Pantitlán) + 1 + 1 + 2,8,9 (Chabacano)', pills.join(',') === '12,1,5,9,A,1,1,2,8,9', pills.join(','));
  st = await stored();
  check('localStorage tiene la copia nueva', st.raw.message === FAKE.message);
  await (await page.$('#status')).screenshot({ path: 'tools/shots/cierres_con.png' });

  console.log('3) Sin red: usa la copia guardada y lo dice');
  mode = { abort: true };
  await load();
  txt = await status();
  check('Sigue mostrando los cierres guardados', txt.includes(FAKE.message) && txt.includes('Pantitlán'));
  check('Indica que no pudo actualizar (sin red) y cuándo se guardaron', /No se pudo actualizar \(sin red\): se muestran los cierres guardados el \d\d\/\d\d\/\d{4} \d\d:\d\d/.test(txt), txt.match(/📴.*$/)?.[0]);
  check('La app cargó (formulario listo)', await page.$eval('#loading', e => e.hidden));
  await (await page.$('#status')).screenshot({ path: 'tools/shots/cierres_offline.png' });

  console.log('4) Archivo roto (coma de más al editar): avisa y usa la copia guardada');
  mode = { body: '{ "stations": ["pantitlan"], }' };
  await load();
  txt = await status();
  check('Aviso de sintaxis en la línea de estado y detalle técnico en "Revisa closures.json"', txt.includes('closures.json tiene un error de sintaxis') && txt.includes('Revisa closures.json') && txt.includes('no es JSON válido'), txt);
  check('Se conservan los cierres guardados', txt.includes(FAKE.message));
  st = await stored();
  check('localStorage NO se sobrescribió con el archivo roto', st.raw.message === FAKE.message);
  await (await page.$('#status')).screenshot({ path: 'tools/shots/cierres_roto.png' });

  console.log('5) Sin red y sin copia guardada (primera vez)');
  await page.evaluate(k => localStorage.removeItem(k), KEY);
  mode = { abort: true };
  await load();
  txt = await status();
  check('Dice que no pudo consultar (motivo: sin red) y remite a Twitter', txt.includes('No pude consultar los cierres') && txt.includes('Motivo: sin red') && txt.includes('Twitter'), txt);
  check('La app cargó igual', await page.$eval('#loading', e => e.hidden));

  console.log('6) Red lenta (5 s): arranca con lo guardado y se actualiza sola al llegar');
  mode = { body: JSON.stringify(FAKE) };
  await load();                                        // deja una copia guardada
  const LATE = { ...FAKE, message: 'Servicio restablecido en L1', stations: [], lines: [], transfers: [] };
  mode = { body: JSON.stringify(LATE), delay: 5000 };
  const t0 = Date.now();
  await page.goto(BASE);
  await page.waitForSelector('#loading[hidden]', { state: 'attached' });
  const tReady = Date.now() - t0;
  txt = await status();
  check(`La app abre antes del timeout de 3 s + margen (tardó ${tReady} ms)`, tReady >= 2900 && tReady < 4500);
  check('Mientras tanto muestra lo guardado con aviso de red lenta', txt.includes(FAKE.message) && txt.includes('la red tardó más de 3 s'), txt);
  await page.waitForFunction(() => document.getElementById('status-body').innerText.includes('Servicio restablecido'), null, { timeout: 8000 });
  txt = await status();
  check('Al llegar la respuesta se actualiza sin recargar', txt.includes('Servicio restablecido') && !txt.includes('No se pudo actualizar'), txt);
  check('Y localStorage ya tiene la nueva', (await stored()).raw.message === 'Servicio restablecido en L1');

  console.log('7) El servidor responde 404 (archivo borrado por error)');
  mode = { status: 404, body: 'Not found' };
  await load();
  txt = await status();
  check('Usa la copia guardada e indica HTTP 404', txt.includes('Servicio restablecido') && txt.includes('el servidor respondió HTTP 404'), txt);

  await browser.close();
  console.log('Errores de consola:', logs.length ? logs : 'ninguno');
  if (logs.length) fails++;
  console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
