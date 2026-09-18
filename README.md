# MetroCDMX PWA — Planificador de rutas del Metro de la Ciudad de México

App web de una sola página que calcula la ruta más rápida entre dos estaciones del Metro (12 líneas, 163 estaciones, 28 de transbordo), con dirección a tomar en cada tramo, mapa esquemático, lista de estaciones, alternativas, hora de llegada y favoritas. Se instala en el teléfono como app y **funciona sin conexión** después de la primera carga.

Sin frameworks, sin backend, sin base de datos: HTML + CSS + JavaScript vanilla y un archivo JSON con los datos.

---

## 1. Archivos del proyecto

| Archivo | Qué es | ¿Lo editas? |
|---|---|---|
| `index.html` | La app completa: estilos, motor de rutas (inyectado) e interfaz | Sí, la interfaz. **El bloque entre `ROUTER:BEGIN` y `ROUTER:END` no**: se genera desde `router.js` |
| `router.js` | Motor de rutas (Dijkstra) y utilidades. Es la fuente del bloque inyectado en `index.html` | Sí, si quieres cambiar el algoritmo o los tiempos |
| `stations.json` | Las 12 líneas (colores, terminales) y las 163 estaciones (nombre, líneas, coordenadas, orden en cada línea) | Sí, cuando el Metro cambie |
| `closures.json` | Cierres vigentes (estaciones, líneas, transbordos) y un mensaje para la gente. La app lo descarga al abrir, sin pasar por la caché, y muestra lo que dice en "Estado del Metro" | **Sí, cada vez que el Metro cierre algo.** Se puede editar desde GitHub en el teléfono, sin `build.js` |
| `manifest.json` | Configuración de la PWA (nombre, colores, íconos) | Rara vez |
| `service-worker.js` | Caché para uso sin conexión. `CACHE_VERSION` la estampa `tools/build.js` | No a mano |
| `icon.svg` → `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Ícono de la app. Los PNG se generan con `tools/make-icons.py` | El SVG, si quieres otro ícono |
| `tools/build.js` | **Único paso obligatorio antes de publicar** (ver §5) | No |
| `tools/sync-router.js` | Copia `router.js` dentro de `index.html` (lo llama `build.js`) | No |
| `tools/make-icons.py` | Convierte `icon.svg` a PNG con Chrome/Edge headless + Pillow | No |
| `tools/build-stations/` | Scripts con los que se generó `stations.json` desde Wikipedia, el portal del STC y Wikidata | Solo para regenerar los datos |
| `tools/test-*.js` | Pruebas automáticas (ver §8) | No |
| `tools/referencia/mis-rutas-metro.html` | Prototipo visual original (rutas fijas). Referencia local; está en `.gitignore` y no se publica | — |
| `docs/ids-estaciones.md` | Tabla de ids de estaciones y líneas para `closures.json`. La regenera `build.js` | No a mano |
| `docs/ACTA-FASE-1.md` | Acta de cierre de la Fase 1 | — |

---

## 2. Probar en tu computadora

La app carga `stations.json` con `fetch()`, y los navegadores bloquean eso cuando abres el archivo con doble clic (`file://`). Hay que servir la carpeta por HTTP:

```bash
cd "C:\Users\user\Documents\GSZ\Proyectos Personales\1. Ruta Metro"
python -m http.server 8000
```

Abre <http://localhost:8000> en Chrome o Edge. Para simular un teléfono: F12 → icono de dispositivo móvil (Ctrl+Shift+M).

Alternativas si no tienes Python: `npx serve .` (Node) o la extensión *Live Server* de VS Code.

> En `localhost` el service worker y la geolocalización sí funcionan (el navegador lo considera contexto seguro). Desde otra computadora o teléfono vía `http://192.168.x.x` verás la app, pero **sin** instalación, **sin** modo offline y **sin** geolocalización: esas tres cosas exigen HTTPS. Para eso está GitHub Pages (§3).

---

## 3. Publicar en GitHub Pages (HTTPS gratis)

Solo se hace una vez. Necesitas una cuenta en <https://github.com>.

### Opción A — sin instalar nada (subiendo archivos por la web)

1. Corre `node tools/build.js` en la carpeta del proyecto (ver §5).
2. En GitHub: botón **New repository** → nombre `metrocdmx` → **Public** → **Create repository**.
3. En la página del repo nuevo: **uploading an existing file** → arrastra **todos** los archivos de la carpeta (incluida la carpeta `tools`, aunque no es necesaria para que funcione) → **Commit changes**.
4. **Settings** (pestaña del repo) → menú izquierdo **Pages** → en *Build and deployment*: Source = **Deploy from a branch**, Branch = **main**, carpeta **/ (root)** → **Save**.
5. Espera 1–2 minutos y recarga la página de Pages: aparece la URL, del tipo `https://TU-USUARIO.github.io/metrocdmx/`.
6. Ábrela en el teléfono. Abajo en la app debe decir **"✓ Lista para usar sin conexión"**.

### Opción B — con Git (recomendada si vas a actualizar seguido)

```bash
cd "C:\Users\user\Documents\GSZ\Proyectos Personales\1. Ruta Metro"
node tools/build.js
git init
git add .
git commit -m "MetroCDMX PWA v1"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/metrocdmx.git
git push -u origin main
```

Después, el paso 4 de la opción A (Settings → Pages → main / root).

> Todo en la app usa rutas relativas (`./`), por eso funciona igual en `https://usuario.github.io/metrocdmx/` que en la raíz de un dominio.

---

## 4. Instalar en el teléfono

Abre la URL de GitHub Pages en el navegador del teléfono. La primera vez necesita internet; después, no.

**Android (Chrome):** menú ⋮ → **Agregar a pantalla de inicio** / **Instalar app** → Instalar. Chrome también suele mostrar un aviso "Agregar Metro a la pantalla principal".

**iPhone (Safari):** botón **Compartir** (cuadro con flecha) → **Agregar a inicio** → Agregar. Se abre a pantalla completa, sin barra del navegador.

Consejo: abre la app **dos veces con internet** antes de confiar en el modo offline. En la primera carga el service worker se instala y guarda la app y los datos; en la segunda guarda también las fuentes tipográficas.

---

## 5. Actualizar la app (después de cualquier cambio)

La app usa caché *cache-first*: el teléfono muestra lo que tiene guardado y **no** busca versiones nuevas por su cuenta. Lo que dispara la actualización es que cambie `CACHE_VERSION` en `service-worker.js`. Para no depender de acordarse, ese número lo estampa un script.

**Único paso obligatorio antes de subir cambios:**

```bash
node tools/build.js
```

Hace tres cosas: (1) copia `router.js` dentro de `index.html`, (2) estampa `CACHE_VERSION` con fecha y hora (`v2026-09-15-1830`), (3) verifica que `stations.json`, `manifest.json`, el service worker y los scripts de `index.html` no tengan errores. Si algo falla, lo dice y no debes publicar.

Luego subes los archivos (opción A: vuelve a arrastrar los que cambiaron, **siempre incluyendo `service-worker.js`**; opción B: `git add . && git commit -m "..." && git push`). En 1–2 minutos GitHub Pages republica.

En el teléfono, la próxima vez que abran la app **con internet**, aparece abajo el aviso **"🆕 Hay una versión nueva — Actualizar"**. Al tocarlo se recarga con los archivos nuevos y se borra la caché vieja.

Si olvidas correr `build.js`, los usuarios seguirán viendo la versión anterior indefinidamente.

---

## 6. Modificar datos y configuración

### 6.1 Estaciones y líneas (`stations.json`)

```json
{
  "lines": {
    "1": { "name": "Línea 1", "color": "#F56394", "textDark": false, "terminals": ["Observatorio", "Pantitlán"], "stationCount": 20, "nick": "Rosa" },
    "B": { "name": "Línea B", "color": "#A8A8A8", "color2": "#007F3A", "textDark": true, "terminals": ["Ciudad Azteca", "Buenavista"], "stationCount": 21, "nick": "Gris/Verde" }
  },
  "stations": [
    { "id": "pantitlan", "name": "Pantitlán", "system": "metro", "lines": ["1", "5", "9", "A"], "transfer": true,
      "lat": 19.41491, "lng": -99.07346, "order": { "1": 20, "5": 1, "9": 12, "A": 1 }, "wikidata": "Q3352997" }
  ]
}
```

- `id`: slug único, sin acentos ni espacios. Es lo que viaja en la URL (`#polanco/chabacano`) y lo que se guarda en favoritas; **no cambies ids de estaciones existentes**.
- `order`: posición de la estación en cada línea, de 1 a N, **sin huecos**. Las terminales son `order` 1 y N; `terminals` debe coincidir con ellas (en ese orden).
- `color`: se usa en píldoras y trazos. `textDark: true` = texto negro sobre ese color (líneas claras: 3, 4, 5, 12, B). `color2` solo para líneas bicolores (B).
- `transfer` es informativo; el motor lo deduce de `lines`.
- `system`: hoy siempre `"metro"`. Está pensado para Metrobús/Trolebús/Cablebús (§9).

**Agregar una estación nueva** (ejemplo: cuando abra la extensión de L12 a Observatorio): a la estación Observatorio agrégale `"12"` en `lines` y su posición en `order`; como `order` debe ir de 1 a N sin huecos, renumera toda la línea 12 (Observatorio 1, Mixcoac 2, … Tláhuac 21) y actualiza `terminals` y `stationCount` de esa línea. Después `node tools/build.js`.

**Regenerar desde las fuentes:** los scripts en `tools/build-stations/` descargan los artículos de Wikipedia por línea, cotejan con `metro.cdmx.gob.mx/la-red`, toman coordenadas de Wikidata y muestrean los colores de las cabeceras oficiales. Orden: `parse_lines.py` → `consolidate.py` → `cotejo.py` → `wikidata.py` → `cabezas.py` → `build_stations.py`. Requieren Python con Pillow y acceso a internet.

### 6.2 Tiempos del motor (`router.js`, arriba)

```js
const ROUTER_DEFAULTS = {
  hopMinutes: 2,        // minutos entre estaciones adyacentes
  transferMinutes: 5,   // minutos por cambio de línea
};
```

Como el transbordo "cuesta" 2.5 estaciones, el motor evita cambiar de línea salvo que ahorre tiempo real. Después de editar: `node tools/build.js`.

### 6.3 Cierres del Metro (`closures.json`) — se edita desde el teléfono, sin `build.js`

Cuando el STC cierra estaciones o una línea (lo anuncia en [@MetroCDMX](https://twitter.com/MetroCDMX)), se escribe en `closures.json`. La app lo descarga cada vez que abre, lo muestra en la tarjeta **"🚨 Estado del Metro"** y calcula las rutas rodeando lo cerrado. **No hay que correr `build.js` ni cambiar la versión**: ese archivo es el único que nunca pasa por la caché.

**Desde el teléfono (GitHub en el navegador):**

1. Abre este enlace y guárdalo en favoritos: <https://github.com/cpgermansolis-maker/metrocdmx-app/edit/main/closures.json>. La primera vez pide iniciar sesión en GitHub.
2. Edita el archivo (ver formato abajo). Cambia también `updated` con la fecha y hora.
3. Toca **Commit changes…** (arriba a la derecha) y confirma en el cuadro que aparece. Listo.
4. Espera **hasta 10 minutos** (GitHub Pages guarda los archivos en su red de distribución ese tiempo) y abre la app: la tarjeta debe mostrar el cierre. Si aparece **"⚠️ Revisa closures.json"**, ahí dice qué corregir (casi siempre un id mal escrito).

Desde la computadora: edita el archivo y súbelo (`git add closures.json && git commit -m "Cierre …" && git push`, o arrastrándolo en la web de GitHub). Correr `build.js` no hace falta, pero si lo corres valida el archivo antes de subirlo.

**Formato, con un cierre real de ejemplo** (L1 sin servicio entre San Lázaro y Pino Suárez):

```json
{
  "_ayuda": "…(instrucciones, no lo borres)…",
  "updated": "18 de septiembre de 2026, 07:30",
  "message": "L1 sin servicio entre San Lázaro y Pino Suárez por obras",
  "stations": ["candelaria", "merced"],
  "lines": [],
  "transfers": []
}
```

| Campo | Qué es | Efecto en las rutas |
|---|---|---|
| `message` | Texto libre que ve la gente en la tarjeta | Ninguno (solo informa) |
| `updated` | Texto libre con fecha/hora; se muestra como "Cierres al …" | Ninguno |
| `stations` | Estaciones **cerradas por completo**: no se puede subir, bajar ni pasar por ellas | La línea queda cortada ahí. Para un tramo cerrado, lista **todas las estaciones intermedias** (las de los extremos siguen abiertas: hasta ahí llega el tren). Si el origen o destino está en la lista, la app avisa "está cerrada" |
| `lines` | Líneas fuera de servicio completas | Desaparecen del cálculo. Una estación cuya única línea está cerrada queda "sin servicio" |
| `transfers` | Estaciones donde **no se puede cambiar de línea**, pero sí pasar | Se usan para rodear, no para transbordar |

**Cómo saber el id de una estación:** en la app, abre **🔎 Buscar estación**, escribe el nombre y abajo aparece **"🆔 id para closures.json: `pino-suarez`"** con un botón **Copiar**. También están todos en [docs/ids-estaciones.md](docs/ids-estaciones.md). Los ids van en minúsculas, sin acentos y con guiones; las líneas son `"1"` a `"12"`, `"A"` y `"B"` (también vale `1` sin comillas).

**Lo que rompe el archivo** (el teclado del teléfono ayuda a equivocarse): comillas curvas `“ ”` en vez de rectas `"`, una coma después del último elemento (`["merced",]`), o una coma que falta entre dos. Si pasa, la app avisa **"closures.json tiene un error de sintaxis"** y sigue con la última copia buena, así que nadie se queda sin rutas; solo hay que corregirlo.

**Para levantar el cierre:** deja las tres listas vacías (`[]`), `message` en `""` y cambia `updated`.

**Lo que hace la app con un cierre** (todo probado en `tools/test-closures-ui.js`):

- La ruta óptima rodea y lo explica: *"⚠️ Ruta ajustada por cierres: evita Candelaria, Merced (cerradas). Sin cierres serían ~37 min (esta tarda 3 más)"*.
- Origen o destino cerrado: *"🚫 Merced está cerrada según el Estado del Metro. Elige otra estación…"*.
- Sin forma de llegar: *"🚫 No hay ruta con los cierres vigentes: la ruta normal (~23 min) pasa por Puebla (cerrada)"*.
- Favoritas, buscador de estación y módulo de autobús muestran el estado (🚫 / ⚠️).
- Sin internet, usa la última copia que consiguió y lo dice. Si la red tarda más de 3 s, abre con la copia y se actualiza sola al llegar la respuesta (recalculando la ruta en pantalla si cambió).

**Limitaciones:** la app solo sabe lo que alguien escribió en el archivo (no lee Twitter); no interpreta horarios ("cerrado de 10 a 14"), hay que poner y quitar el cierre a mano; y el retraso de hasta 10 min de GitHub Pages.

### 6.4 Destinos de autobús (`index.html`, `BUS_DESTINATIONS`)

Cada destino es una entrada; para agregar otro (Puebla desde TAPO, Toluca desde Observatorio…) copia la de Santa Ana y cambia:

```js
'santa-ana-chiautempan': {
  name: 'Santa Ana Chiautempan', emoji: '🚌', terminal: 'TAPO',
  metroStation: 'san-lazaro',   // id de la estación pegada a la terminal
  metroMarginMinutes: 12,       // margen sobre el tiempo del motor (perder la corrida cuesta horas)
  walkMinutes: 5,               // del andén a la taquilla
  bufferMinutes: 15,            // colchón antes de la salida
  tripMinutes: 180,             // duración del viaje en autobús
  phone: '246-137-9308',
  days: { ls: { label: 'Lunes a Sábado', departures: ['07:00', ...] }, vi: {...}, do: {...} },
  dayByWeekday: ['do', 'ls', 'ls', 'ls', 'ls', 'vi', 'ls'],   // índice = día de la semana (0 = domingo)
},
```

El tiempo del Metro hasta la terminal sale de `findRoute(origen, metroStation)`; el resultado muestra el desglose "N min de Metro + margen + caminando".

### 6.5 Ícono

Edita `icon.svg` y corre `python tools/make-icons.py` (necesita Chrome o Edge instalado y Pillow: `pip install pillow`). Mantén el contenido dentro del 80 % central para que se vea bien en Android con íconos recortados.

---

## 7. Cómo funciona (para leer el código)

- **Grafo de andenes.** Cada nodo es `(estación, línea)`, no solo estación. Ir a la estación vecina por la misma línea cuesta `hopMinutes`; cambiar de línea dentro de la misma estación cuesta `transferMinutes`. Así los transbordos se modelan como aristas caras.
- **Dijkstra** (`findRoute`) con "fuente virtual": todos los andenes de la estación de origen arrancan en costo 0, para no cobrar transbordo por elegir la línea correcta al subir. Con 195 nodos no hace falta cola de prioridad; un recorrido lineal tarda 0.1 ms.
- **Tramos y dirección.** El camino se corta donde cambia la línea. La dirección se decide comparando `order` de subida y bajada: si crece, va hacia `terminals[1]`; si decrece, hacia `terminals[0]`.
- **Alternativas** (`findAlternatives`): se vuelve a calcular prohibiendo, una a la vez, cada transbordo y cada línea de la ruta óptima; se descartan duplicados y las que tarden más del doble; se devuelven hasta 2.
- **Interfaz.** `routeCard()` arma cada tarjeta (resumen, direcciones, mapa SVG, tira SVG). Las horas de llegada se recalculan sin recalcular rutas: cada `.eta` lleva sus minutos en `data-min`.
- **PWA.** `service-worker.js` precarga la app y responde primero desde caché; `index.html` registra el SW y avisa cuando hay versión nueva.

---

## 8. Pruebas

```bash
node tools/test-router.js      # motor: 10 casos + 26,406 parejas exhaustivas (solo Node)
node tools/test-closures.js    # closures.json: ids válidos, errores de dedo, listas mal formadas; rutas con cierres (solo Node)
```

Las pruebas de interfaz usan Playwright y necesitan el servidor local en el puerto 8765:

```bash
python -m http.server 8765     # en una terminal
node tools/test-ui.js          # autocompletar, invertir, errores, geolocalización simulada
node tools/test-ui-abc.js      # alternativas, hora de llegada, módulo de autobús
node tools/test-ui-extras.js   # favoritas, estado del Metro, buscador de estación, header compacto
node tools/test-closures-ui.js # cierres en pantalla: tarjeta de estado (con red, sin red, archivo roto, red lenta, 404), rutas desviadas, estación cerrada, favoritas, buscador, autobús, respuesta tardía
node tools/test-pwa.js         # manifest, service worker, uso sin conexión, actualización
```

Si Playwright no está instalado en este proyecto: `npm i playwright && npx playwright install chromium` (los scripts intentan primero el `playwright` local y luego una copia de otro proyecto).

---

## 9. Para el futuro (Metrobús, reportes, etc.)

- **Otro sistema de transporte:** agrega sus estaciones a `stations.json` con `"system": "metrobus"` y líneas con ids que no choquen con las del Metro (p. ej. `"mb-1"`). El motor no distingue sistemas: solo ve líneas, `order` y transbordos. Para conectar Metro con Metrobús, una "estación" que pertenezca a líneas de ambos sistemas funciona como transbordo.
- **Cierres en tiempo real:** hecho en Fase 2 (§6.3). Para automatizarlo algún día, lo que haya que conectar (API, reportes) solo tiene que producir el mismo `closures.json`.
- **Tiempos reales por tramo:** hoy todas las aristas pesan lo mismo; `buildGraph` es el único lugar que asigna pesos, así que se pueden leer de un campo por estación sin tocar Dijkstra.
- **Destinos que no son estación:** `nearestStation(DATA, lat, lng)` ya devuelve la estación más cercana a una coordenada.

---

## 10. Limitaciones conocidas

- Los tiempos son promedios (2 min por estación, 5 por transbordo). En hora pico suma 10–25 %. El módulo de autobús añade un margen configurable precisamente por eso.
- El estado del servicio se toma de `closures.json`, que se edita a mano: la app solo sabe lo que alguien escribió ahí. GitHub Pages puede tardar hasta 10 minutos en servir un cambio. La tarjeta "Estado del Metro" conserva el enlace al Twitter oficial.
- Geolocalización, instalación y modo offline requieren HTTPS o `localhost`.
- Las fuentes de Google se guardan en caché a partir de la **segunda** carga con internet; antes de eso, offline se usa la tipografía del sistema.
- La extensión de la Línea 12 a Observatorio no está incluida (en construcción al generar los datos, septiembre de 2026).

## Fuentes de los datos

Nombres, orden y colores: portal oficial del STC (`metro.cdmx.gob.mx/la-red`). Cotejo: artículos de Wikipedia por línea. Coordenadas: Wikidata (propiedad P625). El ícono es un diseño propio; el logotipo del Metro está registrado y no se reproduce.
