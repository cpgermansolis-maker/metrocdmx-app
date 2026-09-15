// Pruebas del motor de ruteo. Ejecutar desde la raíz del proyecto:
//   node tools/test-router.js
const fs = require('fs');
const path = require('path');
const R = require(path.join(__dirname, '..', 'router.js'));

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'stations.json'), 'utf8'));
const graph = R.buildGraph(data);

const byName = {};
for (const s of data.stations) byName[s.name] = s.id;

// expected: lista de [línea, estaciónDeBajada] por tramo, y número de transbordos.
const CASES = [
  // --- Casos del usuario ---
  { from: 'Polanco', to: 'Chabacano',
    expect: { legs: [['7', 'Tacubaya'], ['9', 'Chabacano']], transfers: 1 } },
  { from: 'San Lázaro', to: 'Cuatro Caminos',
    expect: { legs: [['1', 'Pino Suárez'], ['2', 'Cuatro Caminos']], transfers: 1 } },
  { from: 'Deportivo Oceanía', to: 'Terminal Aérea',
    expect: { legs: [['B', 'Oceanía'], ['5', 'Terminal Aérea']], transfers: 1 } },
  { from: 'Polanco', to: 'San Lázaro',
    expect: { legs: [['7', 'Tacubaya'], ['1', 'San Lázaro']], transfers: 1, avoidLines: ['B'] } },
  { from: 'Ciudad Azteca', to: 'Universidad',
    expect: { minTransfers: 1, note: 'usuario esperaba 2+; ver análisis' } },
  // --- Casos propuestos por Claude ---
  { from: 'Tacubaya', to: 'Pantitlán',
    expect: { legs: [['9', 'Pantitlán']], transfers: 0, note: 'L1 y L9 van directo; debe elegir L9 (11 estaciones) sobre L1 (19)' } },
  { from: 'Pantitlán', to: 'Zócalo/Tenochtitlan',
    expect: { legs: [['9', 'Chabacano'], ['2', 'Zócalo/Tenochtitlan']], transfers: 1, note: 'Chabacano (23 min) gana a Pino Suárez (25 min)' } },
  { from: 'Barranca del Muerto', to: 'Tasqueña',
    expect: { legs: [['7', 'Mixcoac'], ['12', 'Ermita'], ['2', 'Tasqueña']], transfers: 2 } },
  { from: 'Zócalo/Tenochtitlan', to: 'Bellas Artes',
    expect: { legs: [['2', 'Bellas Artes']], transfers: 0, note: 'estaciones casi vecinas, sin transbordo' } },
];

let pass = 0, fail = 0;
for (const c of CASES) {
  const r = R.findRoute(graph, byName[c.from], byName[c.to]);
  console.log('='.repeat(78));
  console.log(`${c.from}  →  ${c.to}` + (c.expect.note ? `   (${c.expect.note})` : ''));
  if (r.error) { console.log('  ERROR:', r.error); fail++; continue; }

  for (const leg of r.legs) {
    console.log(`  ${leg.index}. L${leg.lineId} ▶ dirección ${leg.direction}`);
    console.log(`     Súbete en ${leg.board.name} y baja en ${leg.alight.name}  ·  ${leg.stops} estaciones  ·  ${leg.minutes} min`);
  }
  console.log(`  Total: ${r.totalMinutes} min  (viaje ${r.rideMinutes} + transbordos ${r.transferMinutes})  ·  ${r.transfers} transbordo(s)  ·  líneas ${r.linesUsed.join(', ')}`);
  console.log(`  Tira: ${r.sequence.map(s => s.kind === 'transfer' ? `[${s.name} ⇄ L${s.changeTo}]` : s.name).join(' → ')}`);

  // Verificación contra lo esperado
  const problems = [];
  const e = c.expect;
  if (e.legs) {
    const got = r.legs.map(l => [l.lineId, l.alight.name]);
    if (JSON.stringify(got) !== JSON.stringify(e.legs)) problems.push(`tramos esperados ${JSON.stringify(e.legs)}, obtenidos ${JSON.stringify(got)}`);
  }
  if (e.transfers !== undefined && r.transfers !== e.transfers) problems.push(`transbordos esperados ${e.transfers}, obtenidos ${r.transfers}`);
  if (e.minTransfers !== undefined && r.transfers < e.minTransfers) problems.push(`se esperaban ≥${e.minTransfers} transbordos`);
  if (e.avoidLines) for (const L of e.avoidLines) if (r.linesUsed.includes(L)) problems.push(`no debía usar L${L}`);
  if (r.totalMinutes !== r.totalCost) problems.push(`totalMinutes (${r.totalMinutes}) ≠ costo Dijkstra (${r.totalCost})`);

  if (problems.length) { fail++; console.log('  ✗ FALLA: ' + problems.join('; ')); }
  else { pass++; console.log('  ✓ OK'); }
}

// --- Casos de error controlado ---
console.log('='.repeat(78));
console.log('Errores controlados:');
console.log('  mismo origen y destino →', R.findRoute(graph, 'pantitlan', 'pantitlan').error);
console.log('  id inexistente         →', R.findRoute(graph, 'pantitlan', 'no-existe').error);

// --- Cierre de estación: sin Hidalgo, ¿cómo va Indios Verdes → Zócalo? ---
const closedGraph = R.buildGraph(data, { stations: ['hidalgo'], lines: [] });
const rc = R.findRoute(closedGraph, byName['Indios Verdes'], byName['Zócalo/Tenochtitlan']);
console.log('  con Hidalgo cerrada, Indios Verdes → Zócalo:', rc.legs.map(l => `L${l.lineId}→${l.alight.name}`).join(', '), `(${rc.totalMinutes} min)`);
const rNormal = R.findRoute(graph, byName['Indios Verdes'], byName['Zócalo/Tenochtitlan']);
console.log('  sin cierre:                                  ', rNormal.legs.map(l => `L${l.lineId}→${l.alight.name}`).join(', '), `(${rNormal.totalMinutes} min)`);

// --- Alternativas ---
console.log('='.repeat(78));
console.log('Alternativas:');
{
  const opt = R.findRoute(graph, byName['Polanco'], byName['Chabacano']);
  const alts = R.findAlternatives(graph, opt);
  const got = alts.map(a => a.legs.map(l => 'L' + l.lineId + '→' + l.alight.name).join(', ') + ` (+${a.deltaMinutes} min, ${a.variant})`);
  console.log('  Polanco → Chabacano:', got);
  const ok1 = alts.length === 1 && got[0].startsWith('L7→Tacuba, L2→Chabacano');
  const none = R.findAlternatives(graph, R.findRoute(graph, byName['Zócalo/Tenochtitlan'], byName['Bellas Artes']));
  console.log('  Zócalo → Bellas Artes:', none.length ? none : 'sin alternativas (correcto)');
  // Muestra aleatoria: cada alternativa debe ser distinta, no más lenta que 2x y sin errores
  let bad = 0, n = 0, withAlts = 0, t0 = Date.now();
  for (let i = 0; i < 1500; i++) {
    const a = data.stations[Math.floor(Math.random() * data.stations.length)], b = data.stations[Math.floor(Math.random() * data.stations.length)];
    if (a.id === b.id) continue;
    const o = R.findRoute(graph, a.id, b.id); const al = R.findAlternatives(graph, o); n++;
    if (al.length) withAlts++;
    const sigs = new Set([R.routeSignature(o)]);
    for (const x of al) { if (x.error || x.totalMinutes > o.totalMinutes * 2 || x.deltaMinutes < 0 || sigs.has(R.routeSignature(x))) bad++; sigs.add(R.routeSignature(x)); }
  }
  console.log(`  Muestra: ${n} parejas, ${withAlts} con alternativas, ${bad} inválidas, ${Date.now() - t0} ms`);
  if (ok1 && none.length === 0 && bad === 0) { pass++; console.log('  ✓ OK'); } else { fail++; console.log('  ✗ FALLA'); }
}

// --- Prueba exhaustiva: todas las parejas posibles deben tener ruta ---
let pairs = 0, errors = 0, t0 = Date.now();
for (const a of data.stations) for (const b of data.stations) {
  if (a.id === b.id) continue;
  pairs++;
  const r = R.findRoute(graph, a.id, b.id);
  if (r.error || r.totalMinutes !== r.totalCost) errors++;
}
console.log('='.repeat(78));
console.log(`Exhaustivo: ${pairs} parejas, ${errors} errores, ${Date.now() - t0} ms  (${((Date.now() - t0) / pairs).toFixed(3)} ms por ruta)`);
console.log(`Resultado: ${pass} OK, ${fail} fallas de ${CASES.length + 1} casos`);
process.exit(fail ? 1 : 0);
