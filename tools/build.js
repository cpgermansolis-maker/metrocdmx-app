// ============================================================================
// build.js — ÚNICO paso obligatorio antes de subir cambios.
//
//   node tools/build.js
//
// Hace cuatro cosas:
//   1. Inyecta router.js dentro de index.html (tools/sync-router.js).
//   2. Estampa CACHE_VERSION en service-worker.js con la fecha y hora actual
//      (p. ej. 'v2026-09-15-1830'). Con eso el navegador de cada usuario
//      detecta que hay versión nueva, vuelve a descargar los archivos y
//      muestra el aviso "Hay una versión nueva".
//   3. Verifica que stations.json, manifest.json y closures.json sean JSON
//      válido (y que closures.json solo use ids existentes), y que
//      service-worker.js e index.html no tengan errores de sintaxis.
//   4. Regenera docs/ids-estaciones.md (tabla de ids para closures.json) a
//      partir de stations.json, para que nunca quede desactualizada.
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
const versionLine = /const CACHE_VERSION = '[^']*';/;
if (!versionLine.test(sw)) { console.error('No encontré la línea CACHE_VERSION en service-worker.js'); problems++; }
else {
  // Se compara con la expresión y no con el texto resultante: si se corre dos
  // veces en el mismo minuto la versión no cambia y eso no es un error.
  fs.writeFileSync(swPath, sw.replace(versionLine, `const CACHE_VERSION = '${version}';`), 'utf8');
  console.log(`service-worker.js: CACHE_VERSION = '${version}'`);
}

// 3. Verificaciones
const parsed = {};
for (const name of ['stations.json', 'manifest.json', 'closures.json']) {
  try { parsed[name] = JSON.parse(fs.readFileSync(file(name), 'utf8')); console.log(`${name}: JSON válido`); }
  catch (e) { console.error(`${name}: JSON INVÁLIDO → ${e.message}`); problems++; }
}
// closures.json: mismos avisos que mostraría la app (ids desconocidos, listas mal formadas).
if (parsed['stations.json'] && parsed['closures.json']) {
  const { normalizeClosures } = require(file('router.js'));
  const { closures, warnings } = normalizeClosures(parsed['closures.json'], parsed['stations.json']);
  if (warnings.length) { for (const w of warnings) console.error(`closures.json: ${w}`); problems++; }
  else console.log(`closures.json: OK (${closures.stations.length} estaciones, ${closures.lines.length} líneas, ${closures.transfers.length} transbordos cerrados)`);
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

// 4. docs/ids-estaciones.md
if (parsed['stations.json']) {
  const d = parsed['stations.json'];
  const byName = [...d.stations].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const lines = Object.entries(d.lines);
  const md = [
    '# Ids para `closures.json`',
    '',
    'Generado por `tools/build.js` desde `stations.json`; no editar a mano. Cómo usarlo: README §6.3.',
    '',
    `## Líneas (${lines.length})`,
    '',
    '| id | Línea |', '|---|---|',
    ...lines.map(([id, l]) => `| \`${id}\` | ${l.name} |`),
    '',
    `## Estaciones (${byName.length})`,
    '',
    '| Estación | id | Líneas | Transbordo |', '|---|---|---|---|',
    ...byName.map(st => `| ${st.name} | \`${st.id}\` | ${st.lines.join(', ')} | ${st.transfer ? 'sí' : ''} |`),
    '',
  ].join('\n');
  const docsDir = path.join(root, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, 'ids-estaciones.md'), md, 'utf8');
  console.log(`docs/ids-estaciones.md: ${byName.length} estaciones, ${lines.length} líneas`);
}

console.log(problems ? `\n${problems} problema(s). Corrige antes de publicar.` : '\nListo para publicar. Sube los archivos (git add / commit / push).');
process.exit(problems ? 1 : 0);
