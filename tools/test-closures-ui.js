// Prueba de los cierres en la interfaz: la tarjeta "Estado del Metro" (carga
// de closures.json con red, sin red, con archivo roto, con red lenta y con
// error del servidor) y su efecto en rutas, favoritas, buscador y autobús.
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
  // waitUntil 'load' (no 'networkidle') cuando closures.json va a tardar: networkidle esperaría la respuesta lenta.
  const load = async (hash = '', waitUntil = 'networkidle') => { await page.goto(BASE + hash, { waitUntil }); await page.waitForSelector('#loading[hidden]', { state: 'attached' }); };
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

  // Ir a BASE#hash desde BASE solo cambia el hash (no recarga): para que la app
  // vuelva a pedir closures.json hay que pasar por about:blank.
  const loadFresh = async (hash, waitUntil) => { await page.goto('about:blank'); await load(hash, waitUntil); };
  const formErr = () => page.$eval('#form-err', e => ({ hidden: e.hidden, text: e.innerText.replace(/\s+/g, ' ').trim() }));
  const optNote = () => page.$eval('#optimal', e => { const n = e.querySelector('.closure-note'); return n ? n.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const optLines = () => page.$$eval('#optimal .lines-mini .lpill', els => els.map(e => e.textContent).join(','));
  const CUT = { updated: 'hoy', message: 'L1 cortada entre San Lázaro y Pino Suárez', stations: ['candelaria', 'merced'], lines: ['12'], transfers: [] };

  console.log('8) Las rutas respetan los cierres (Candelaria y Merced cerradas, L12 cerrada)');
  mode = { body: JSON.stringify(CUT) };
  await loadFresh('#san-lazaro/cuatro-caminos');
  await page.waitForSelector('#results:not([hidden])');
  check('San Lázaro → Cuatro Caminos rodea por B, 3, 2', (await optLines()) === 'B,3,2', await optLines());
  let note = await optNote();
  check('La óptima explica el ajuste: evita Candelaria, Merced; sin cierres ~37 min, +3', note.includes('Ruta ajustada por cierres') && note.includes('evita Candelaria, Merced (cerradas)') && note.includes('Sin cierres serían ~37 min (esta tarda 3 más)'), note);
  check('Tiempo mostrado 40 min', (await page.$eval('#optimal .val.big', e => e.textContent)).includes('40'));
  await page.click('#btn-alts'); await page.waitForSelector('#alts .card');
  check('Las alternativas tampoco pasan por Candelaria/Merced', !(await page.$eval('#alts', e => e.innerText)).match(/Candelaria|Merced/));
  await (await page.$('#optimal .card-head')).screenshot({ path: 'tools/shots/cierres_ruta_ajustada.png' });

  await loadFresh('#san-lazaro/merced');
  let fe = await formErr();
  check('Destino cerrado: aviso claro y sin resultados', !fe.hidden && fe.text.includes('Merced está cerrada según el Estado del Metro') && fe.text.includes('otra estación de destino') && await page.$eval('#results', e => e.hidden), fe.text);
  await (await page.$('#form-err')).screenshot({ path: 'tools/shots/cierres_destino_cerrado.png' });
  await loadFresh('#merced/san-lazaro');
  fe = await formErr();
  check('Origen cerrado: aviso claro', !fe.hidden && fe.text.includes('Merced está cerrada') && fe.text.includes('otra estación de origen'), fe.text);
  await loadFresh('#tlahuac/pantitlan');
  fe = await formErr();
  check('Estación cuya única línea está cerrada: "no tiene servicio: la Línea 12 está cerrada"', !fe.hidden && fe.text.includes('Tláhuac no tiene servicio: la Línea 12 está cerrada'), fe.text);

  console.log('9) Sin ruta posible por los cierres (Pantitlán aislada)');
  mode = { body: JSON.stringify({ ...CUT, lines: [], stations: ['zaragoza', 'hangares', 'puebla', 'agricola-oriental'] }) };
  await loadFresh('#pantitlan/zocalo-tenochtitlan');
  fe = await formErr();
  check('Explica que la ruta normal pasa por Puebla (cerrada)', !fe.hidden && fe.text.includes('No hay ruta con los cierres vigentes') && fe.text.includes('ruta normal (~23 min) pasa por Puebla (cerrada)'), fe.text);

  console.log('10) Favoritas, buscador y autobús con cierres');
  mode = { body: JSON.stringify(CUT) };
  await page.evaluate(() => localStorage.setItem('metrocdmx-favs', JSON.stringify([{ from: 'san-lazaro', to: 'merced' }, { from: 'san-lazaro', to: 'cuatro-caminos' }, { from: 'polanco', to: 'chabacano' }])));
  await loadFresh('');
  const favs = await page.$$eval('#fav-list .fav-item .meta', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  check('Favorita con destino cerrado: "🚫 destino cerrado"', favs[0].includes('🚫 destino cerrado'), favs[0]);
  check('Favorita desviada: "⚠️ ajustada por cierres" y 40 min', favs[1].includes('40 min') && favs[1].includes('ajustada por cierres'), favs[1]);
  check('Favorita no afectada: sin avisos', favs[2].includes('21 min') && !favs[2].includes('🚫') && !favs[2].includes('⚠️'), favs[2]);
  await page.click('.col-head[data-toggle="lookup-card"]'); await page.waitForTimeout(400);
  await page.fill('#lookup', 'Merced'); await page.waitForSelector('#lookup-info .st-name');
  check('Buscador: Merced marcada "🚫 Cerrada"', (await page.$eval('#lookup-info .st-sub', e => e.innerText)).includes('🚫 Cerrada'));
  await page.fill('#lookup', 'Tláhuac');                       // también coincide Cuitláhuac: hay que elegir de la lista
  await page.press('#lookup', 'Enter');                         // Enter toma la primera de la lista (la exacta)
  await page.waitForFunction(() => document.querySelector('#lookup-info .st-name')?.innerText.includes('Tláhuac'));
  const lk = await page.$eval('#lookup-info', e => e.innerText.replace(/\s+/g, ' '));
  check('Buscador: Tláhuac "Sin servicio (línea cerrada)" y la L12 marcada cerrada', lk.includes('🚫 Sin servicio (línea cerrada)') && lk.includes('Línea 12 🚫 cerrada'), lk);
  await page.click('.col-head[data-toggle="satana"]'); await page.waitForTimeout(400);
  await page.fill('#sa-origen', 'Merced'); await page.fill('#sa-hora', '17:00'); await page.click('#sa-calc'); await page.waitForTimeout(150);
  const saErr = await page.$eval('#sa-err', e => e.innerText.replace(/\s+/g, ' '));
  check('Autobús desde estación cerrada: mismo aviso', saErr.includes('Merced está cerrada según el Estado del Metro'), saErr);

  console.log('11) Los cierres llegan tarde con una ruta en pantalla');
  await page.evaluate(k => localStorage.removeItem(k), KEY);
  mode = { body: JSON.stringify(CUT), delay: 4500 };
  await loadFresh('#san-lazaro/cuatro-caminos', 'load');
  await page.waitForSelector('#results:not([hidden])');
  check('Arranca con la ruta normal (L1, L2) y sin nota', (await optLines()) === '1,2' && (await optNote()) === '', await optLines());
  await page.waitForSelector('.toast.info', { timeout: 8000 });
  check('Aviso "Cierres actualizados: recalculé la ruta"', (await page.$eval('.toast.info', e => e.innerText)).includes('recalculé la ruta'));
  check('La tarjeta ya muestra la ruta desviada con su nota', (await optLines()) === 'B,3,2' && (await optNote()).includes('evita Candelaria, Merced'), await optLines());
  check('Y la tarjeta de estado muestra el mensaje del cierre', (await status()).includes(CUT.message));
  // Segunda variante: la ruta en pantalla deja de ser posible.
  await page.evaluate(k => localStorage.removeItem(k), KEY);
  await loadFresh('#san-lazaro/merced', 'load');
  await page.waitForSelector('#results:not([hidden])');
  await page.waitForSelector('.toast.info', { timeout: 8000 });
  fe = await formErr();
  check('Ruta que se vuelve imposible: se oculta, aviso de destino cerrado y toast', (await page.$eval('.toast.info', e => e.innerText)).includes('ya no es posible') && await page.$eval('#results', e => e.hidden) && fe.text.includes('Merced está cerrada'), fe.text);
  // Sin cambios reales: no debe molestar con avisos.
  await page.evaluate(k => localStorage.removeItem(k), KEY);
  await loadFresh('#polanco/chabacano', 'load');
  await page.waitForSelector('#results:not([hidden])');
  await page.waitForFunction(() => document.getElementById('status-body').innerText.includes('L1 cortada'), null, { timeout: 8000 });
  await page.waitForTimeout(300);
  check('Ruta no afectada (Polanco → Chabacano): sin toast ni nota', !(await page.$('.toast.info')) && (await optNote()) === '' && (await optLines()) === '7,9');

  await browser.close();
  console.log('Errores de consola:', logs.length ? logs : 'ninguno');
  if (logs.length) fails++;
  console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
