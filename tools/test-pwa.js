// Prueba de la PWA: service worker, precarga en caché, funcionamiento sin
// conexión y aviso de versión nueva.
// Requiere el servidor local:  python -m http.server 8765      →  node tools/test-pwa.js
const fs = require('fs');
const path = require('path');
function requirePlaywright() {
  try { return require('playwright'); } catch (e) {}
  return require('C:/Users/user/Documents/Auditorías/Ejecución y plan semanal/Plan y Productividad Semanal/Robot Agenda Ejecutiva/node_modules/playwright');
}
const { chromium } = requirePlaywright();
const SW_PATH = path.join(__dirname, '..', 'service-worker.js');
const BASE = 'http://127.0.0.1:8765/';
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? '  → ' + extra : ''}`); if (!ok) fails++; };

(async () => {
  const swOriginal = fs.readFileSync(SW_PATH, 'utf8');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Sin red, Chrome reporta como error de consola el fetch fallido de closures.json; es el caso esperado.
  page.on('console', m => { if (m.type() === 'error' && !(m.location().url || '').includes('closures.json')) errors.push(m.text()); });
  try {
    console.log('1) Manifest');
    const man = await (await page.request.get(BASE + 'manifest.json')).json();
    check('manifest.json se sirve y parsea', man.name === 'MetroCDMX' && man.short_name === 'Metro' && man.display === 'standalone');
    check('theme/background #0d0f14', man.theme_color === '#0d0f14' && man.background_color === '#0d0f14');
    for (const ic of man.icons) { const r = await page.request.get(BASE + ic.src); check(`ícono ${ic.src} (${ic.sizes}, ${ic.purpose})`, r.ok()); }

    console.log('2) Service worker');
    await page.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
    check('<link rel=manifest> presente', await page.$eval('link[rel=manifest]', l => l.getAttribute('href')) === 'manifest.json');
    const swState = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; return reg.active && reg.active.state; });
    check('SW registrado y activo', swState === 'activated', swState);
    await page.waitForFunction(() => document.getElementById('pwa-badge').textContent.includes('sin conexión'));
    check('Badge: lista para usar sin conexión', (await page.$eval('#pwa-badge', e => e.textContent)).includes('Lista'));
    // Segunda carga: ya controlada por el SW → las fuentes de Google pasan por él y se cachean
    await page.reload({ waitUntil: 'networkidle' });
    check('Página controlada por el SW', await page.evaluate(() => !!navigator.serviceWorker.controller));
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys(); const c = await caches.open(keys.find(k => k.startsWith('metrocdmx-')));
      return { keys, urls: (await c.keys()).map(r => r.url) };
    });
    const curVer = (swOriginal.match(/CACHE_VERSION = '([^']*)'/) || [])[1];
    check(`Caché metrocdmx-${curVer}`, cached.keys.includes('metrocdmx-' + curVer), JSON.stringify(cached.keys));
    for (const f of ['index.html', 'manifest.json', 'stations.json', 'icon-192.png', 'icon-512.png']) check(`precargado: ${f}`, cached.urls.some(u => u.endsWith('/' + f)));
    check('fuentes de Google en caché', cached.urls.some(u => u.includes('fonts.googleapis.com')) && cached.urls.some(u => u.includes('fonts.gstatic.com')), cached.urls.filter(u => u.includes('fonts')).length + ' entradas');
    check('closures.json NO está en caché (siempre va a la red)', !cached.urls.some(u => u.endsWith('/closures.json')));
    check('Estado del Metro leído de la red', (await page.$eval('#status-body', e => e.innerText)).includes('Sin cierres reportados') && !(await page.$eval('#status-body', e => e.innerText)).includes('No se pudo actualizar'));

    console.log('3) Sin conexión');
    await context.setOffline(true);
    // Pasar por about:blank obliga a una carga completa: ir de index.html a
    // index.html#… solo cambia el hash y el navegador no recarga nada.
    await page.goto('about:blank');
    await page.goto(BASE + 'index.html#polanco/chabacano', { waitUntil: 'load' });
    await page.waitForSelector('#results:not([hidden])', { timeout: 10000 });
    check('Recarga offline: la app abre', (await page.title()).includes('Metro CDMX'));
    check('stations.json desde caché (163 estaciones)', await page.evaluate(() => DATA && DATA.stations.length) === 163);
    check('Ruta calculada offline', (await page.$eval('#optimal .od', e => e.innerText)).includes('Chabacano'));
    await page.waitForFunction(() => document.getElementById('pwa-badge').textContent.includes('Sin conexión'));
    check('Badge: sin conexión', true);
    const font = await page.evaluate(() => document.fonts.check('800 20px "Bricolage Grotesque"'));
    check('Tipografía Bricolage disponible offline', font);
    const stTxt = await page.$eval('#status-body', e => e.innerText.replace(/\s+/g, ' '));
    check('Estado del Metro offline: usa la copia guardada y lo dice', stTxt.includes('Sin cierres reportados') && /No se pudo actualizar \(sin red\): se muestran los cierres guardados el \d\d\/\d\d\/\d{4}/.test(stTxt), stTxt);
    await page.screenshot({ path: 'tools/shots/pwa_offline.png' });
    await context.setOffline(false);

    console.log(`4) Actualización (CACHE_VERSION ${curVer} → vTEST)`);
    fs.writeFileSync(SW_PATH, swOriginal.replace(/const CACHE_VERSION = '[^']*';/, "const CACHE_VERSION = 'vTEST';"), 'utf8');
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
    await page.waitForSelector('.toast', { timeout: 15000 });
    check('Aparece el aviso "versión nueva"', (await page.$eval('.toast', e => e.innerText)).includes('versión nueva'));
    await page.click('.toast button');
    await page.waitForLoadState('networkidle');
    const keysAfter = await page.evaluate(async () => caches.keys());
    check('Caché vieja borrada, queda vTEST', keysAfter.includes('metrocdmx-vTEST') && !keysAfter.includes('metrocdmx-' + curVer), JSON.stringify(keysAfter));
  } finally {
    fs.writeFileSync(SW_PATH, swOriginal, 'utf8');   // restaurar la versión original pase lo que pase
    await browser.close();
  }
  console.log('Errores de consola:', errors.length ? errors : 'ninguno');
  if (errors.length) fails++;
  console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
