# Acta de cierre · MetroCDMX PWA · Fase 1

**Fecha:** 15 de septiembre de 2026
**Responsable del proyecto:** Germán Solís
**Estado:** Fase 1 completa y aprobada. Repositorio: <https://github.com/cpgermansolis-maker/metrocdmx-app>

---

## 1. Qué se construyó

Una PWA de una sola página (`index.html`, ~1,300 líneas: CSS + motor + interfaz) que planifica rutas entre las **163 estaciones** del Metro CDMX (12 líneas, 28 estaciones de transbordo, 195 estación-línea).

**Datos.** `stations.json` generado desde el portal oficial del STC (nombres, orden y colores muestreados de sus cabeceras), cotejado contra los artículos de Wikipedia por línea y con coordenadas de Wikidata. Validado por Germán línea por línea (12/12) y estación de transbordo por estación (28/28).

**Motor de rutas** (`router.js`). Dijkstra sobre un grafo de andenes (estación, línea): 2 min por estación adyacente y 5 min por transbordo, configurables en `ROUTER_DEFAULTS`. Fuente virtual en el origen (no se cobra transbordo por elegir la línea correcta al subir). Cierres configurables en `CLOSURES`: estaciones, líneas y "solo transbordo". Alternativas por exclusión (`findAlternatives`): se recalcula prohibiendo, una a la vez, cada transbordo y cada línea de la óptima; hasta 2, sin duplicados, ≤ 2× el tiempo de la óptima. Probado con 10 casos y 26,406 parejas exhaustivas sin errores.

**Interfaz** (mobile-first, sistema visual del prototipo `mis-rutas-metro.html`):
- Geolocalización con Haversine → estación más cercana y distancia; se pone como origen.
- Autocompletar sin acentos ni mayúsculas, con píldoras de línea, teclado y selección automática por coincidencia exacta.
- Invertir, hora de salida ("Salgo a las", vacío = ahora) y hora estimada de llegada, que se actualiza en todas las tarjetas al cambiar la hora.
- Tarjeta óptima + pregunta "¿Te acomoda esta ruta?" + alternativas etiquetadas "+X min vs óptima"; cada tarjeta con direcciones por tramo (línea, dirección, sube/baja, estaciones, minutos), mapa SVG esquemático (dobla en cada transbordo, etiquetas alternadas) y tira vertical con todas las estaciones.
- Contraste: colores oficiales en píldoras y trazos; los oscuros (L9, L2, LA) se aclaran solo como texto; halo bajo los trazos; Línea B bicolor.
- Favoritas en `localStorage['metrocdmx-favs']` (pares de ids), sección colapsable "Mis favoritas".
- Enlace "🚨 Ver estado del Metro" al Twitter oficial, con nota de que no está integrado.
- Buscador de estación: líneas que pasan, posición en cada línea y estaciones vecinas hacia cada terminal; botones para usar como origen o destino.
- Módulo "Viaje a Santa Ana Chiautempan": horarios por tipo de día, tiempo del Metro desde `findRoute` + margen configurable (12 min) + caminata (5) + colchón (15), desglosado; destinos en `BUS_DESTINATIONS` para agregar más sin tocar la función.
- Ruta en la URL (`#origen/destino`), con respuesta a atrás/adelante.

**PWA.** `manifest.json` (MetroCDMX / Metro, standalone, `#0d0f14`), `service-worker.js` cache-first con precarga de app, datos e íconos y caché al vuelo de fuentes; aviso "Hay una versión nueva → Actualizar"; badge de estado en el pie. Íconos de diseño propio (`icon.svg` → 192/512 + `apple-touch-icon` 180) y metas para iPhone. Probado sin conexión (recarga, datos, ruta y tipografía desde caché) y el ciclo de actualización.

**Herramientas** (`tools/`): `build.js` (inyecta `router.js` en el HTML, estampa `CACHE_VERSION` con fecha-hora y valida sintaxis; **único paso obligatorio antes de publicar**), `sync-router.js`, `make-icons.py`, `build-stations/` (regenerar datos desde las fuentes) y cinco suites de pruebas (`test-router.js` en Node; `test-ui.js`, `test-ui-abc.js`, `test-ui-extras.js`, `test-pwa.js` con Playwright; 90+ verificaciones, cero errores de consola).

**Documentación.** `README.md`: archivos y cuáles editar, prueba local, publicación en GitHub Pages paso a paso, instalación en Android/iPhone, procedimiento de actualización, edición de datos y configuración, pruebas, arquitectura y limitaciones.

---

## 2. Qué se asumió sin preguntar

1. Ante discrepancias, manda el portal del STC sobre Wikipedia: "Candelaria" (sin "/Palacio Legislativo"), "Etiopía/Plaza de la Transparencia", "UAM Azcapotzalco", "La Villa/Basílica".
2. La extensión de la Línea 12 a Observatorio no se incluyó (en construcción).
3. `textDark` se interpretó como "usar texto negro sobre el color"; L1/L6/L7 quedaron con texto blanco por señalética oficial, aunque el cálculo WCAG sugería negro.
4. Una estación cerrada corta la línea (no se puede pasar por ella); una exclusión de transbordo sí deja pasar, solo impide cambiar de línea.
5. "N estaciones" cuenta las recorridas sin la de subida.
6. Los nombres con "/" se acortan en el mapa ("Zócalo", "Garibaldi"); en tarjetas y tira van completos.
7. Los colores oscuros se aclaran solo cuando se usan como texto; píldoras y trazos conservan el color oficial.
8. La ruta viaja en la URL (`#origen/destino`) y la app responde a `hashchange`.
9. "Salgo a las" asume el día de hoy (no cruza medianoche); con el campo vacío la hora se refresca cada 30 s.
10. Las favoritas guardan ids, no nombres; la sección se abre sola al guardar la primera.
11. Módulo de autobús: el día se preselecciona por la fecha del dispositivo; el margen de 12 min aplica solo si hay tramo en Metro; apertura del Metro 5:00 L–V / 6:00 sábado / 7:00 domingo; botón extra "Ver esta ruta en el planificador".
12. Ícono de diseño propio en lugar del logotipo registrado del STC.
13. El service worker también cachea las fuentes de Google (a partir de la segunda carga con internet); sin red ni caché, una navegación devuelve la app; usa `skipWaiting` + `clients.claim`.
14. El motor vive en `router.js` y se inyecta en el HTML mediante `build.js` (cumple el requisito "inline" sin duplicar código).
15. GitHub Pages como hosting recomendado (no se pidió uno).
16. Las pruebas de interfaz cargan Playwright desde otro proyecto local por ruta absoluta si no está instalado en este.
17. El commit inicial lleva nombre y correo de Germán pasados inline (Git no tenía configuración global) y una línea de coautoría de Claude.

---

## 3. Qué quedó fuera

- Estado del servicio en tiempo real (solo enlace externo).
- Metrobús, Trolebús, Cablebús y destinos que no son estación.
- Tiempos reales por tramo y ajuste por hora pico (solo la nota del pie).
- Accesibilidad física (elevadores, escaleras), tarifas y horarios de operación dentro del planificador.
- Botón de compartir (la URL ya lo permite) y sincronización de favoritas entre dispositivos.
- **No se probó en Safari/iOS, Firefox ni en dispositivos reales:** todas las pruebas corrieron en Chromium headless con viewport de 390 px.
- Publicación en GitHub Pages: el repositorio existe y tiene el código; falta activar Pages (Settings → Pages → main / root).

---

## 4. Backlog de Fase 2

- `README.md` §9 "Para el futuro": otro sistema de transporte (campo `system`, ids de línea con prefijo), cierres desde API o reportes (`CLOSURES` + `buildGraph`), pesos por tramo (solo `buildGraph` asigna pesos), destinos por coordenada (`nearestStation`).
- `README.md` §10 "Limitaciones conocidas".
- Puntos de extensión ya presentes en el código: `system` en `stations.json`, `CLOSURES` (stations / lines / transfers), `BUS_DESTINATIONS`, `ROUTER_DEFAULTS`.
- Alcance original de Fase 2 según el encargo: Metrobús, Trolebús, Cablebús, reportes colaborativos, cierres en tiempo real, destinos que no son estación.

---

## 5. Fuentes de los datos

Portal oficial del STC (`metro.cdmx.gob.mx/la-red`) para nombres, orden y colores; artículos de Wikipedia por línea para cotejo; Wikidata (P625) para coordenadas. El logotipo del Metro está registrado y no se reproduce; el ícono es diseño propio.
