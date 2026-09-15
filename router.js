/* ============================================================================
   router.js — Motor de ruteo del MetroCDMX PWA
   ----------------------------------------------------------------------------
   Idea central: en vez de un grafo de estaciones, usamos un grafo de
   "andenes": cada nodo es la pareja (estación, línea). Así:

     - Ir de una estación a la vecina POR LA MISMA LÍNEA es una arista barata.
     - Cambiar de línea DENTRO de la misma estación es una arista cara
       (representa caminar por los pasillos y esperar el siguiente tren).

   Dijkstra encuentra el camino de menor costo total, y como el transbordo
   cuesta más que avanzar dos o tres estaciones, el algoritmo evita cambiar de
   línea salvo que realmente le convenga.

   El motor NO lee stations.json por su cuenta: recibe los datos como
   parámetro (buildGraph) y devuelve un grafo que luego se pasa a findRoute.
   Eso permite en el futuro construir un grafo combinado Metro + Metrobús
   + Cablebús sin tocar el algoritmo.
   ========================================================================== */

/* ---------- 1. Configuración ---------------------------------------------- */

// Pesos del grafo, en minutos. Cambia aquí si quieres calibrar tiempos.
const ROUTER_DEFAULTS = {
  hopMinutes: 2,        // entre dos estaciones adyacentes de la misma línea
  transferMinutes: 5,   // caminar + esperar al cambiar de línea en una estación
};

// Cierres. Por ahora vacío; en el futuro se llena desde una API o reportes
// colaborativos. Una estación cerrada desaparece del grafo (no se puede
// subir, bajar, ni pasar por ella). Una línea cerrada desaparece completa.
const CLOSURES = {
  stations: [],   // ids de estación, p. ej. ["zocalo-tenochtitlan"]
  lines: [],      // ids de línea, p. ej. ["12"]
  transfers: [],  // ids de estación donde NO se permite cambiar de línea
                  // (se puede pasar, pero no transbordar). Lo usan las alternativas.
};

/* ---------- 2. Construcción del grafo ------------------------------------- */

// Cada nodo se identifica con una cadena "idEstacion@idLinea".
function nodeKey(stationId, lineId) {
  return stationId + '@' + lineId;
}

/**
 * Construye el grafo a partir de los datos.
 * @param {object} data      Contenido de stations.json ({ lines, stations }).
 * @param {object} closures  { stations: [...ids], lines: [...ids], transfers: [...ids] }
 * @param {object} cfg       { hopMinutes, transferMinutes }
 * @returns {object} grafo   { nodes, edges, stationsById, lines, cfg }
 *
 * Nota para el futuro: si se agrega Metrobús, sus líneas deben llevar un id
 * distinto al del Metro (p. ej. "mb-1" en lugar de "1") para no chocar.
 */
function buildGraph(data, closures = CLOSURES, cfg = ROUTER_DEFAULTS) {
  const closedStations  = new Set(closures.stations || []);
  const closedLines     = new Set(closures.lines || []);
  const closedTransfers = new Set(closures.transfers || []);

  const stationsById = {};
  for (const s of data.stations) stationsById[s.id] = s;

  const nodes = new Map();  // key -> { stationId, lineId }
  const edges = new Map();  // key -> [ { to, weight, kind } ]

  function addNode(stationId, lineId) {
    const k = nodeKey(stationId, lineId);
    if (!nodes.has(k)) { nodes.set(k, { stationId, lineId }); edges.set(k, []); }
    return k;
  }
  // Las aristas son bidireccionales: el tren va y viene.
  function addEdge(a, b, weight, kind) {
    edges.get(a).push({ to: b, weight, kind });
    edges.get(b).push({ to: a, weight, kind });
  }

  // 2a. Aristas de "viaje": estaciones consecutivas de cada línea.
  for (const lineId of Object.keys(data.lines)) {
    if (closedLines.has(lineId)) continue;

    // Estaciones de esta línea, ordenadas por su posición (campo order).
    const seq = data.stations
      .filter(s => s.lines.includes(lineId) && !closedStations.has(s.id))
      .sort((a, b) => a.order[lineId] - b.order[lineId]);

    for (let i = 0; i < seq.length; i++) {
      const k = addNode(seq[i].id, lineId);
      if (i > 0) {
        // Si una estación intermedia está cerrada, seq ya la omitió y la
        // línea queda "cortada" ahí: no se puede pasar por una estación cerrada.
        const prevOrder = seq[i - 1].order[lineId];
        const thisOrder = seq[i].order[lineId];
        if (thisOrder - prevOrder === 1) {
          addEdge(nodeKey(seq[i - 1].id, lineId), k, cfg.hopMinutes, 'ride');
        }
      }
    }
  }

  // 2b. Aristas de "transbordo": dentro de una estación, entre cada par de
  //     líneas que la sirven. En Pantitlán (4 líneas) son 6 pares.
  for (const s of data.stations) {
    if (closedStations.has(s.id) || closedTransfers.has(s.id)) continue;
    const lines = s.lines.filter(l => !closedLines.has(l));
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        addEdge(nodeKey(s.id, lines[i]), nodeKey(s.id, lines[j]), cfg.transferMinutes, 'transfer');
      }
    }
  }

  // Guardamos data y closures para poder reconstruir variantes del grafo
  // (lo usa findAlternatives).
  return { nodes, edges, stationsById, lines: data.lines, cfg, data, closures };
}

/* ---------- 3. Dijkstra ---------------------------------------------------- */

/**
 * Calcula la ruta óptima entre dos estaciones.
 * @returns {object} ruta, o { error: "mensaje" } si no es posible.
 */
function findRoute(graph, originId, destId) {
  const { nodes, edges, stationsById, cfg } = graph;

  if (!stationsById[originId] || !stationsById[destId]) return { error: 'Estación desconocida.' };
  if (originId === destId) return { error: 'Origen y destino son la misma estación.' };

  // dist: mejor costo conocido para llegar a cada nodo. prev: de dónde venimos.
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  // "Fuente virtual": el usuario puede subirse a CUALQUIER línea que pase por
  // la estación de origen sin costo. Por eso todos esos nodos arrancan en 0.
  let hasStart = false;
  for (const [k, n] of nodes) {
    if (n.stationId === originId) { dist.set(k, 0); hasStart = true; }
  }
  if (!hasStart) return { error: 'La estación de origen está cerrada.' };

  let endKey = null;

  // Con ~195 nodos no hace falta un montículo (heap): buscar el nodo
  // pendiente más barato con un recorrido lineal es instantáneo.
  while (true) {
    let current = null, best = Infinity;
    for (const [k, d] of dist) {
      if (!visited.has(k) && d < best) { best = d; current = k; }
    }
    if (current === null) break;                 // ya no hay nodos alcanzables

    visited.add(current);
    // Primer nodo del destino que "cerramos" = camino óptimo garantizado.
    if (nodes.get(current).stationId === destId) { endKey = current; break; }

    for (const e of edges.get(current)) {
      if (visited.has(e.to)) continue;
      const cand = best + e.weight;
      if (cand < (dist.has(e.to) ? dist.get(e.to) : Infinity)) {
        dist.set(e.to, cand);
        prev.set(e.to, current);
      }
    }
  }

  if (endKey === null) return { error: 'No hay ruta disponible entre esas estaciones.' };

  // Reconstruir el camino de nodos, del destino hacia atrás.
  const path = [];
  for (let k = endKey; k !== undefined; k = prev.get(k)) path.unshift(nodes.get(k));

  return describeRoute(graph, path, dist.get(endKey));
}

/* ---------- 4. Convertir el camino en instrucciones ------------------------ */

/**
 * Recibe la secuencia de nodos (estación, línea) y la parte en tramos (legs):
 * cada vez que cambia la línea empieza un tramo nuevo.
 */
function describeRoute(graph, path, totalCost) {
  const { stationsById, lines, cfg } = graph;
  const brief = id => ({ id, name: stationsById[id].name });

  // Agrupar nodos consecutivos con la misma línea.
  const groups = [];
  for (const n of path) {
    const g = groups[groups.length - 1];
    if (g && g.lineId === n.lineId) g.stationIds.push(n.stationId);
    else groups.push({ lineId: n.lineId, stationIds: [n.stationId] });
  }
  // Un nodo de transbordo aparece dos veces seguidas (misma estación, dos
  // líneas), así que cada grupo ya incluye su estación de subida y bajada.

  const legs = groups.map((g, i) => {
    const line = lines[g.lineId];
    const boardId  = g.stationIds[0];
    const alightId = g.stationIds[g.stationIds.length - 1];
    const stops = g.stationIds.length - 1;

    // Dirección: comparamos el orden ordinal de subida vs bajada dentro de la
    // línea. Si crece, vamos hacia la terminal final; si decrece, hacia la inicial.
    const ordBoard  = stationsById[boardId].order[g.lineId];
    const ordAlight = stationsById[alightId].order[g.lineId];
    const towardsEnd = ordAlight > ordBoard;
    const direction = towardsEnd ? line.terminals[1] : line.terminals[0];

    return {
      index: i + 1,
      lineId: g.lineId,
      lineName: line.name,
      color: line.color,
      color2: line.color2 || null,
      textDark: !!line.textDark,
      direction,
      board: brief(boardId),
      alight: brief(alightId),
      stations: g.stationIds.map(brief),                 // incluye subida y bajada
      intermediate: g.stationIds.slice(1, -1).map(brief),
      stops,                                             // "son N estaciones"
      minutes: stops * cfg.hopMinutes,
    };
  });

  const transfers = legs.length - 1;
  const rideMinutes = legs.reduce((a, l) => a + l.minutes, 0);
  const transferMinutes = transfers * cfg.transferMinutes;

  // Secuencia completa de estaciones para la "tira" vertical, marcando
  // origen, destino y transbordos (con la línea a la que hay que cambiar).
  const sequence = [];
  legs.forEach((leg, i) => {
    leg.stations.forEach((st, j) => {
      if (i > 0 && j === 0) {
        // Esta estación ya la agregó el tramo anterior: solo la marcamos.
        const last = sequence[sequence.length - 1];
        last.kind = 'transfer';
        last.changeTo = leg.lineId;
        return;
      }
      sequence.push({ ...st, lineId: leg.lineId, kind: 'ride' });
    });
  });
  sequence[0].kind = 'origin';
  sequence[sequence.length - 1].kind = 'destination';

  return {
    origin: legs[0].board,
    destination: legs[legs.length - 1].alight,
    legs,
    transfers,
    transferStations: legs.slice(1).map(l => l.board),
    linesUsed: [...new Set(legs.map(l => l.lineId))],
    rideMinutes,
    transferMinutes,
    totalMinutes: rideMinutes + transferMinutes,   // igual a totalCost de Dijkstra
    totalCost,
    sequence,
  };
}

/* ---------- 5. Rutas alternativas ----------------------------------------- */

// "Firma" de una ruta: misma secuencia de tramos = misma ruta.
function routeSignature(route) {
  return route.legs.map(l => l.lineId + ':' + l.board.id + '>' + l.alight.id).join('|');
}

/**
 * Busca rutas realmente distintas a la óptima. Estrategia: se vuelve a
 * calcular la ruta prohibiendo, una a la vez, (a) cada transbordo de la
 * óptima y (b) cada línea que usa. Se descartan duplicados, la propia
 * óptima y las que tarden más de `maxFactor` veces la óptima.
 * @returns {Array} rutas ordenadas por tiempo, cada una con deltaMinutes y variant.
 */
function findAlternatives(graph, optimal, { max = 2, maxFactor = 2 } = {}) {
  const { data, closures, cfg } = graph;
  const seen = new Set([routeSignature(optimal)]);
  const found = [];

  function tryWith(extra, variant) {
    const merged = {
      stations:  [...(closures.stations  || []), ...(extra.stations  || [])],
      lines:     [...(closures.lines     || []), ...(extra.lines     || [])],
      transfers: [...(closures.transfers || []), ...(extra.transfers || [])],
    };
    const r = findRoute(buildGraph(data, merged, cfg), optimal.origin.id, optimal.destination.id);
    if (r.error) return;
    const sig = routeSignature(r);
    if (seen.has(sig) || r.totalMinutes > optimal.totalMinutes * maxFactor) return;
    seen.add(sig);
    r.deltaMinutes = r.totalMinutes - optimal.totalMinutes;
    r.variant = variant;
    found.push(r);
  }

  for (const t of optimal.transferStations) tryWith({ transfers: [t.id] }, 'sin cambiar en ' + t.name);
  for (const l of optimal.linesUsed)        tryWith({ lines: [l] },        'sin usar ' + graph.lines[l].name);

  found.sort((a, b) => a.totalMinutes - b.totalMinutes);
  return found.slice(0, max);
}

/* ---------- 6. Utilidades de búsqueda ------------------------------------- */

// Quita acentos y mayúsculas para comparar: "Tláhuac" -> "tlahuac".
function normalize(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Busca estaciones cuyo nombre contenga el texto (sin acentos ni mayúsculas).
function searchStations(data, query, limit = 8) {
  const q = normalize(query.trim());
  if (!q) return [];
  const starts = [], contains = [];
  for (const s of data.stations) {
    const n = normalize(s.name);
    if (n.startsWith(q)) starts.push(s);
    else if (n.includes(q)) contains.push(s);
  }
  return [...starts, ...contains].slice(0, limit);
}

// Distancia en metros entre dos coordenadas (fórmula de Haversine).
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Estación más cercana a una coordenada.
function nearestStation(data, lat, lng) {
  let best = null, bestDist = Infinity;
  for (const s of data.stations) {
    const d = haversine(lat, lng, s.lat, s.lng);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return { station: best, meters: Math.round(bestDist) };
}

/* ---------- 7. Exportar (solo para pruebas en Node) ------------------------ */
// En el navegador estas funciones quedan como globales dentro del <script>.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ROUTER_DEFAULTS, CLOSURES, buildGraph, findRoute, describeRoute, findAlternatives, routeSignature,
                     searchStations, nearestStation, haversine, normalize, nodeKey };
}
