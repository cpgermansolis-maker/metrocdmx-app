# CLAUDE.md — MetroCDMX PWA

Contexto para retomar el proyecto en futuras sesiones. La documentación de usuario está en `README.md`; el acta de cierre de Fase 1 en `docs/ACTA-FASE-1.md`. Este archivo guarda lo que NO está ahí: estado, reglas de trabajo, decisiones y trampas.

## Qué es

PWA de una sola página (HTML + CSS + JS vanilla, sin frameworks ni backend) que calcula rutas óptimas entre las 163 estaciones del Metro CDMX, con alternativas, hora de llegada, favoritas, buscador de estación y un módulo de conexión con autobús (Santa Ana Chiautempan). Funciona offline. Dueño: Germán Solís (contador, nivel intermedio HTML/JS, autodidacta).

## Estado al 17 de septiembre de 2026

- **Fase 1 completa y aprobada** (5 pasos: datos → motor → interfaz → PWA → extras/README). Probada por Germán en Chrome Android vía GitHub Pages: rutas correctas, offline OK, aviso de versión nueva confirmado.
- Repositorio: `https://github.com/cpgermansolis-maker/metrocdmx-app` (rama `main`). App publicada en `https://cpgermansolis-maker.github.io/metrocdmx-app/`.
- **Fase 2 en curso: cierres en tiempo real** (elegido por Germán el 17-sep sobre Metrobús, reportes colaborativos y destinos no-estación). Plan de 3 pasos:
  1. ✅ `closures.json` + carga con copia en localStorage + tarjeta "Estado del Metro" (`36bf07f`, aprobado).
  2. ✅ Cierres aplicados a rutas, alternativas, favoritas, buscador y autobús; nota "Ruta ajustada por cierres"; avisos de origen/destino cerrado; recálculo con toast si la respuesta llega tarde.
  3. ⏳ Sección en README de cómo editar `closures.json` desde GitHub en el teléfono + prueba real de Germán.
- Este `CLAUDE.md` sí está en el repo (`5f6ab29`).

## Por dónde retomar la próxima sesión

1. Preguntar a Germán si en el teléfono vio la tarjeta "Estado del Metro" con "✅ Sin cierres reportados" tras `36bf07f`, y si hubo hallazgos.
2. Paso 2 de cierres (aplicarlos a las rutas). Mismo método: un paso, evidencia, aprobación.

## Completado (últimas entradas; el historial completo está en git)

- 17-sep-2026 · `36bf07f` Fase 2 paso 1: `closures.json`, `normalizeClosures()`, tarjeta de cierres, SW deja pasar el archivo, `build.js` lo valida, pruebas `test-closures.js` y `test-closures-ui.js`. Corrección del parpadeo del header (`html{overflow-anchor:none}`) y de la prueba offline de `test-pwa.js` (no recargaba de verdad).
- 17-sep-2026 · `5f6ab29` `CLAUDE.md` al repo.
- 15-sep-2026 · `50c85d1` Header sticky compacto al hacer scroll (hallazgo de prueba en Chrome Android).
- 15-sep-2026 · `1757dc5` Acta de cierre de Fase 1 en `docs/ACTA-FASE-1.md`.
- 15-sep-2026 · `c598853` Fase 1 completa: datos, motor, interfaz, PWA, extras, README. Publicada en GitHub Pages.

## Reglas obligatorias de este repo

1. **`router.js` es la única fuente del motor.** El bloque entre `<!-- ROUTER:BEGIN -->` y `<!-- ROUTER:END -->` en `index.html` se genera; nunca editarlo a mano.
2. **`node tools/build.js` antes de cualquier commit que se vaya a publicar.** Inyecta el motor, estampa `CACHE_VERSION` con fecha-hora (sin eso los teléfonos no ven la actualización) y valida sintaxis/JSON.
3. **No cambiar `id` de estaciones existentes** en `stations.json`: viajan en la URL (`#origen/destino`) y en `localStorage['metrocdmx-favs']`.
4. `order` de cada línea va de 1 a N sin huecos; `terminals` = estaciones con `order` 1 y N.
5. Pruebas: `node tools/test-router.js` y `node tools/test-closures.js` (solo Node) y, con `python -m http.server 8765` corriendo, `test-ui.js`, `test-ui-abc.js`, `test-ui-extras.js`, `test-closures-ui.js`, `test-pwa.js` (Playwright). Correr todo antes de dar algo por terminado.
8. **`closures.json` nunca se cachea** (el SW lo deja pasar; la app lo pide con `cache: 'no-store'`). Editarlo no requiere `build.js` ni cambiar `CACHE_VERSION`. Cualquier cambio de formato debe seguir siendo tolerante: `normalizeClosures()` descarta con aviso, nunca lanza.
6. `tools/referencia/` (prototipo original de Germán) y `tools/shots/` (capturas) están en `.gitignore`; no publicarlos.
7. Git en esta máquina no tiene `user.name`/`user.email` globales: los commits se han hecho con `-c user.name="Germán Solís" -c user.email="cpgermansolis@gmail.com"`. Mensajes en español; incluir la línea `Co-Authored-By` de Claude.

## Cómo trabaja Germán (respetarlo)

- Aprueba **paso por paso** y coteja él mismo antes de firmar. No avanzar al siguiente paso sin su OK explícito.
- Quiere **cada decisión técnica explicada** en el mensaje (el porqué, no solo el qué) y **evidencia**: salidas de tests, capturas, números.
- Acepta correcciones a su propio prompt cuando hay evidencia (colores de línea, caso Ciudad Azteca → Universidad).
- Criterio operativo: para conexiones con autobús usa **tiempos máximos** (perder la corrida cuesta 1–2 h), no promedios.
- Prefiere que los pasos manuales propensos a olvido los haga un script (por eso `build.js` estampa la versión).
- Reporta hallazgos de prueba en teléfono real; se atienden con commit + push y se le avisa para que vea el aviso de actualización.

## Decisiones técnicas clave (no re-litigar)

- Grafo de andenes `(estación, línea)`; Dijkstra con recorrido lineal (195 nodos, sin heap); fuente virtual en el origen.
- Pesos en `ROUTER_DEFAULTS` (2 min/estación, 5 min/transbordo). Cierres en `CLOSURES` con `stations` (corta la línea), `lines` y `transfers` (solo impide cambiar de línea; se puede pasar). Las alternativas usan `transfers` y `lines`, una exclusión a la vez, ≤ 2× la óptima, máx. 2.
- Nombres oficiales del portal del STC mandan sobre Wikipedia. Colores muestreados de las cabeceras oficiales. L12 sin Observatorio (en construcción). Ícono propio (el logo del STC está registrado).
- `textDark` = usar texto negro sobre el color (L3, L4, L5, L12, B). `lineTextColor()` aclara colores oscuros solo cuando se usan como texto.
- Service worker cache-first con `skipWaiting` + `clients.claim`; cachea también fuentes de Google; navegación sin red devuelve `index.html`.
- `BUS_DESTINATIONS` es configurable por destino; el tiempo del Metro sale de `findRoute` + `metroMarginMinutes` (12) + `walkMinutes` (5) + `bufferMinutes` (15), siempre desglosado en pantalla.
- Header sticky que se compacta a ~35 px al hacer scroll (umbrales 60/20 px). `html{overflow-anchor:none}` es obligatorio: sin eso el scroll anchoring del navegador hace oscilar el header sin parar si el scroll queda entre 60 y 80 px (hay prueba de regresión en `test-ui-extras.js`).
- Cierres: `closures.json` = `{ updated, message, stations[], lines[], transfers[] }` (+ `_ayuda`). Se pide a la red con espera máxima de 3 s (`CLOSURES_TIMEOUT_MS`); copia en `localStorage['metrocdmx-closures']` = `{ fetchedAt, raw }`. `applyClosures(state)` es el único punto que fija `closuresState`: reconstruye `GRAPH` y, si `uiReady`, re-renderiza favoritas, buscador y la ruta en pantalla (`refreshCurrentRoute`, con toast solo si cambió). `GRAPH_OPEN` (sin cierres) sirve para explicar el cambio: `closureNoteFor()` compara firmas y usa `routeClosureConflicts()`; `closureErrorHtml()` traduce los `code` de `findRoute` (`origin-closed`, `dest-closed`, `no-route`, `same`, `unknown`). La tarjeta distingue red / copia guardada / nada, y muestra los avisos de `normalizeClosures`. GitHub Pages tarda hasta 10 min en servir un cambio.

## Backlog de Fase 2 (no iniciado)

Del encargo original: Metrobús, Trolebús, Cablebús (usar campo `system` e ids de línea con prefijo, p. ej. `mb-1`), reportes colaborativos (requieren backend; descartado por ahora), destinos que no son estación (`nearestStation` ya existe). Cierres en tiempo real: en curso (ver Estado). Ideas adicionales en `README.md` §9 y limitaciones en §10. Pendiente de prueba: Safari/iOS y Firefox (solo se probó Chromium headless y Chrome Android).

## Trampas conocidas del entorno

- Chrome headless en Windows impone ~500 px de ancho mínimo de ventana; para capturas móviles usar Playwright con viewport 390 (los tests ya lo hacen).
- Playwright no está instalado en este proyecto; los scripts lo cargan desde `C:/Users/user/Documents/Auditorías/.../Robot Agenda Ejecutiva/node_modules/playwright` como respaldo.
- Scripts largos por heredoc de bash fallan con "unexpected EOF"; escribirlos a archivo (Write) y ejecutarlos.
- `page.waitForSelector` de Playwright espera elementos visibles; para `[hidden]` usar `{ state: 'attached' }`.
- Los avisos "LF will be replaced by CRLF" de Git son inofensivos.
- Al terminar pruebas, matar el `http.server` del puerto 8765 (`netstat -ano | grep :8765` → `taskkill //PID … //F`).
- `page.goto` de Playwright a la misma URL cambiando solo el `#hash` NO recarga la página (navegación de fragmento); para una recarga real pasar por `about:blank`.
- `context.setOffline(true)` sí afecta a los fetch que el SW deja pasar sin `respondWith`; para interceptar `closures.json` con `page.route` hay que crear el contexto con `serviceWorkers: 'block'`.
- `page.goto(..., { waitUntil: 'networkidle' })` espera también a las respuestas retrasadas con `page.route` (`setTimeout` + `fulfill`); para probar "respuesta tardía" usar `waitUntil: 'load'`.
- El autocompletar solo toma sola una coincidencia exacta única; "Tláhuac" también coincide con "Cuitláhuac", así que en pruebas hay que dar Enter o elegir de la lista.
- Los heredocs de bash con `\n` dentro de cadenas Python se corrompen (el `\n` llega como salto de línea real); usar Write para el script y ejecutarlo.
