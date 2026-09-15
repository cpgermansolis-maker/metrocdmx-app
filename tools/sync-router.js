// Copia el contenido de router.js dentro de index.html, entre los marcadores
// <!-- ROUTER:BEGIN --> y <!-- ROUTER:END -->. Así router.js es la única
// fuente de verdad y se puede probar con Node (tools/test-router.js).
//
//   node tools/sync-router.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');

const html = fs.readFileSync(htmlPath, 'utf8');
const router = fs.readFileSync(path.join(root, 'router.js'), 'utf8');

const BEGIN = '<!-- ROUTER:BEGIN -->';
const END = '<!-- ROUTER:END -->';
const a = html.indexOf(BEGIN), b = html.indexOf(END);
if (a < 0 || b < 0 || b < a) { console.error('No encontré los marcadores ROUTER:BEGIN / ROUTER:END en index.html'); process.exit(1); }

const block = `${BEGIN}\n<!-- Generado desde router.js por tools/sync-router.js. Edita router.js, no este bloque. -->\n<script>\n${router.trim()}\n</script>\n`;
const out = html.slice(0, a) + block + html.slice(b);
fs.writeFileSync(htmlPath, out, 'utf8');
console.log(`router.js (${router.length} chars) inyectado en index.html`);
