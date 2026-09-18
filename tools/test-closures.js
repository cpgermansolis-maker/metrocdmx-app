// Pruebas de normalizeClosures (router.js): cómo se interpreta closures.json.
// Ejecutar desde la raíz del proyecto:   node tools/test-closures.js
const fs = require('fs');
const path = require('path');
const R = require(path.join(__dirname, '..', 'router.js'));

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'stations.json'), 'utf8'));
const live = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'closures.json'), 'utf8'));
let fails = 0;
const check = (label, ok, extra = '') => { console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? '  → ' + extra : ''}`); if (!ok) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('1) closures.json del repositorio');
{
  const n = R.normalizeClosures(live, data);
  check('sin avisos', n.warnings.length === 0, n.warnings.join(' | '));
  check('trae "updated"', n.updated.length > 0, n.updated);
  check('el grafo se construye con sus cierres', R.buildGraph(data, n.closures).nodes.size === 195);
}

console.log('2) Archivo bien formado con cierres reales');
{
  const raw = {
    updated: '17 de septiembre de 2026, 10:00',
    message: 'L1 sin servicio de Pantitlán a Isabel la Católica por obras',
    stations: ['pantitlan', 'zaragoza', 'gomez-farias', 'boulevard-puerto-aereo', 'balbuena', 'moctezuma', 'san-lazaro', 'candelaria', 'merced', 'pino-suarez', 'isabel-la-catolica'],
    lines: ['12'],
    transfers: ['chabacano'],
  };
  const n = R.normalizeClosures(raw, data);
  check('sin avisos', n.warnings.length === 0, n.warnings.join(' | '));
  check('11 estaciones, 1 línea, 1 transbordo', n.closures.stations.length === 11 && same(n.closures.lines, ['12']) && same(n.closures.transfers, ['chabacano']));
  check('updated y message pasan tal cual', n.updated === raw.updated && n.message === raw.message);
  const g = R.buildGraph(data, n.closures);
  check('el grafo ya no tiene andenes de L12', ![...g.nodes.keys()].some(k => k.endsWith('@12')));
  check('el grafo ya no tiene Pantitlán', ![...g.nodes.keys()].some(k => k.startsWith('pantitlan@')));
}

console.log('3) Errores de dedo: se descartan y se avisa, sin tumbar la app');
{
  const raw = { updated: '', stations: ['zocalo', 'pino-suarez', 'Pino-Suarez '], lines: [1, '13', 'b'], transfers: ['merced'] };
  const n = R.normalizeClosures(raw, data);
  check('id de estación desconocido "zocalo" avisado', n.warnings.some(w => w.includes('"zocalo"')));
  check('"Pino-Suarez " (mayúsculas/espacio) NO se acepta: los ids son exactos', n.warnings.some(w => w.includes('"Pino-Suarez"')));
  check('solo queda pino-suarez', same(n.closures.stations, ['pino-suarez']), JSON.stringify(n.closures.stations));
  check('línea 1 escrita como número se acepta', n.closures.lines.includes('1'));
  check('líneas "13" y "b" avisadas', n.warnings.some(w => w.includes('"13"')) && n.warnings.some(w => w.includes('"b"')));
  check('merced en transfers avisa que no es de transbordo', n.warnings.some(w => w.includes('merced') && w.includes('transbordo')));
  check('total de avisos = 5', n.warnings.length === 5, n.warnings.join(' | '));
}

console.log('4) Listas mal formadas y archivo vacío');
{
  let n = R.normalizeClosures({ stations: 'pino-suarez', lines: null }, data);
  check('"stations" como texto → aviso y lista vacía', n.warnings.some(w => w.includes('"stations" debe ser una lista')) && n.closures.stations.length === 0);
  check('"lines": null se ignora sin aviso', !n.warnings.some(w => w.includes('lines')));
  n = R.normalizeClosures({}, data);
  check('{} → sin cierres, sin avisos', n.warnings.length === 0 && same(n.closures, { stations: [], lines: [], transfers: [] }));
  n = R.normalizeClosures([], data);
  check('[] (lista en vez de objeto) → aviso', n.warnings.length === 1 && n.warnings[0].includes('debe ser un objeto'));
  n = R.normalizeClosures(null, data);
  check('null → aviso, sin excepción', n.warnings.length === 1);
  n = R.normalizeClosures({ updated: 42, message: ['x'] }, data);
  check('updated/message con tipo raro → se ignoran', n.updated === '' && n.message === '');
}

console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
process.exit(fails ? 1 : 0);
