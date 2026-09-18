# CLAUDE.md — MetroCDMX PWA

Contexto para retomar el proyecto en futuras sesiones. La documentación de usuario está en `README.md`; el acta de cierre de Fase 1 en `docs/ACTA-FASE-1.md`. Este archivo guarda lo que NO está ahí: estado, reglas de trabajo, decisiones y trampas.

## Qué es

PWA de una sola página (HTML + CSS + JS vanilla, sin frameworks ni backend) que calcula rutas óptimas entre las 163 estaciones del Metro CDMX, con alternativas, hora de llegada, favoritas, buscador de estación y un módulo de conexión con autobús (Santa Ana Chiautempan). Funciona offline. Dueño: Germán Solís (contador, nivel intermedio HTML/JS, autodidacta).

## Estado al 15 de septiembre de 2026

- **Fase 1 completa y aprobada** (5 pasos: datos → motor → interfaz → PWA → extras/README). Probada por Germán en Chrome Android vía GitHub Pages: rutas correctas, offline OK.
- Repositorio: `https://github.com/cpgermansolis-maker/metrocdmx-app` (rama `main`). App publicada en `https://cpgermansolis-maker.github.io/metrocdmx-app/`.
- Sin hallazgos abiertos. Fase 2 no iniciada.
- Este `CLAUDE.md` existe solo en local (no se pidió commitearlo).

## Por dónde retomar la próxima sesión

1. Preguntar a Germán si vio el aviso "Hay una versión nueva" en el teléfono tras `50c85d1` y si hubo más hallazgos.
2. Ofrecer commit + push de este `CLAUDE.md`.
3. Si arranca Fase 2, empezar por definir el alcance con él (ver backlog abajo) y seguir el mismo método: un paso, evidencia, aprobación.

## Completado (últimas entradas; el historial completo está en git)

- 15-sep-2026 · `50c85d1` Header sticky compacto al hacer scroll (hallazgo de prueba en Chrome Android).
- 15-sep-2026 · `1757dc5` Acta de cierre de Fase 1 en `docs/ACTA-FASE-1.md`.
- 15-sep-2026 · `c598853` Fase 1 completa: datos, motor, interfaz, PWA, extras, README. Publicada en GitHub Pages.

## Reglas obligatorias de este repo

1. **`router.js` es la única fuente del motor.** El bloque entre `<!-- ROUTER:BEGIN -->` y `<!-- ROUTER:END -->` en `index.html` se genera; nunca editarlo a mano.
2. **`node tools/build.js` antes de cualquier commit que se vaya a publicar.** Inyecta el motor, estampa `CACHE_VERSION` con fecha-hora (sin eso los teléfonos no ven la actualización) y valida sintaxis/JSON.
3. **No cambiar `id` de estaciones existentes** en `stations.json`: viajan en la URL (`#origen/destino`) y en `localStorage['metrocdmx-favs']`.
4. `order` de cada línea va de 1 a N sin huecos; `terminals` = estaciones con `order` 1 y N.
5. Pruebas: `node tools/test-router.js` (solo Node) y, con `python -m http.server 8765` corriendo, `test-ui.js`, `test-ui-abc.js`, `test-ui-extras.js`, `test-pwa.js` (Playwright). Correr todo antes de dar algo por terminado.
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
- Header sticky que se compacta a ~35 px al hacer scroll (umbrales 60/20 px).

## Backlog de Fase 2 (no iniciado)

Del encargo original: Metrobús, Trolebús, Cablebús (usar campo `system` e ids de línea con prefijo, p. ej. `mb-1`), reportes colaborativos, cierres en tiempo real (alimentar `CLOSURES` y reconstruir con `buildGraph`), destinos que no son estación (`nearestStation` ya existe). Ideas adicionales en `README.md` §9 y limitaciones en §10. Pendiente de prueba: Safari/iOS y Firefox (solo se probó Chromium headless y Chrome Android).

## Trampas conocidas del entorno

- Chrome headless en Windows impone ~500 px de ancho mínimo de ventana; para capturas móviles usar Playwright con viewport 390 (los tests ya lo hacen).
- Playwright no está instalado en este proyecto; los scripts lo cargan desde `C:/Users/user/Documents/Auditorías/.../Robot Agenda Ejecutiva/node_modules/playwright` como respaldo.
- Scripts largos por heredoc de bash fallan con "unexpected EOF"; escribirlos a archivo (Write) y ejecutarlos.
- `page.waitForSelector` de Playwright espera elementos visibles; para `[hidden]` usar `{ state: 'attached' }`.
- Los avisos "LF will be replaced by CRLF" de Git son inofensivos.
- Al terminar pruebas, matar el `http.server` del puerto 8765 (`netstat -ano | grep :8765` → `taskkill //PID … //F`).
