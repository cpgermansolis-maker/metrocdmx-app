// ============================================================================
// build.js — ÚNICO paso obligatorio antes de subir cambios.
//
//   node tools/build.js
//
// Hace tres cosas:
//   1. Inyecta router.js dentro de index.html (tools/sync-router.js).
//   2. Estampa CACHE_VERSION en service-worker.js con la fecha y hora actual
//      (p. ej. 'v2026-09-15-1830'). Con eso el navegador de cada usuario
//      detecta que hay versión nueva, vuelve a descargar los archivos y
//      muestra el aviso "Hay una versión nueva".
//   3. Verifica que stations.json y manifest.json sean JSON válido y que
//      service-worker.js e index.html no tengan errores de sintaxis.
// ============================================================================
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const file = name => path.join(root, name);
let problems = 0;

// 1. router.js → index.html
execFileSync(process.execPath, [path.join(__dirname, 'sync-router.js')], { stdio: 'inherit' });

// 2. Estampar la versión de la caché
const d = new Date();
const pad = n => String(n).padStart(2, '0');
const version = `v${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const swPath = file('service-worker.js');
const sw = fs.readFileSync(swPath, 'utf8');
const stamped = sw.replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = '${version}';`);
if (stamped === sw) { console.error('No encontré la línea CACHE_VERSION en service-worker.js'); problems++; }
else { fs.writeFileSync(swPath, stamped, 'utf8'); console.log(`service-worker.js: CACHE_VERSION = '${version}'`); }

// 3. Verificaciones
for (const name of ['stations.json', 'manifest.json']) {
  try { JSON.parse(fs.readFileSync(file(name), 'utf8')); console.log(`${name}: JSON válido`); }
  catch (e) { console.error(`${name}: JSON INVÁLIDO → ${e.message}`); problems++; }
}
try { execFileSync(process.execPath, ['--check', swPath], { stdio: 'pipe' }); console.log('service-worker.js: sintaxis OK'); }
catch (e) { console.error('service-worker.js: ERROR de sintaxis\n' + e.stderr); problems++; }

// Sintaxis de los <script> de index.html: se extraen y se revisan uno por uno.
const html = fs.readFileSync(file('index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const tmp = path.join(require('os').tmpdir(), 'metrocdmx-check.js');
scripts.forEach((src, i) => {
  fs.writeFileSync(tmp, src, 'utf8');
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { console.error(`index.html <script> #${i + 1}: ERROR de sintaxis\n` + e.stderr); problems++; }
});
try { fs.unlinkSync(tmp); } catch (e) {}
if (scripts.length) console.log(`index.html: ${scripts.length} bloques <script> con sintaxis OK`);

console.log(problems ? `\n${problems} problema(s). Corrige antes de publicar.` : '\nListo para publicar. Sube los archivos (git add / commit / push).');
process.exit(problems ? 1 : 0);
