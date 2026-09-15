import json, sys, re, unicodedata
sys.stdout.reconfigure(encoding='utf-8')

data   = json.load(open('parsed_lines.json', encoding='utf-8'))
wd     = json.load(open('wikidata.json', encoding='utf-8'))
coords = wd['coords']; qids = wd['qids']

# Nombres oficiales (portal metro.cdmx.gob.mx) donde Wikipedia difiere
OVERRIDES = {
    'Candelaria/Palacio Legislativo':   'Candelaria',
    'Etiopía/Plaza de la Trasparencia': 'Etiopía/Plaza de la Transparencia',
    'UAM-Azcapotzalco':                 'UAM Azcapotzalco',
    'La Villa-Basílica':                'La Villa/Basílica',
}

# Colores muestreados de las cabeceras oficiales del STC (metro.cdmx.gob.mx)
LINES = {
    '1':  {'name':'Línea 1',  'color':'#F56394', 'nick':'Rosa'},
    '2':  {'name':'Línea 2',  'color':'#0064A8', 'nick':'Azul'},
    '3':  {'name':'Línea 3',  'color':'#AE9D27', 'nick':'Verde olivo'},
    '4':  {'name':'Línea 4',  'color':'#6FB7AE', 'nick':'Turquesa'},
    '5':  {'name':'Línea 5',  'color':'#FDDF00', 'nick':'Amarillo'},
    '6':  {'name':'Línea 6',  'color':'#FF1100', 'nick':'Rojo'},
    '7':  {'name':'Línea 7',  'color':'#FF6309', 'nick':'Naranja'},
    '8':  {'name':'Línea 8',  'color':'#018749', 'nick':'Verde'},
    '9':  {'name':'Línea 9',  'color':'#5B2C2A', 'nick':'Café'},
    'A':  {'name':'Línea A',  'color':'#A3277C', 'nick':'Morado'},
    'B':  {'name':'Línea B',  'color':'#A8A8A8', 'color2':'#007F3A', 'nick':'Gris/Verde'},
    '12': {'name':'Línea 12', 'color':'#B99E51', 'nick':'Dorado'},
}

def luminance(hexc):
    r,g,b = [int(hexc[i:i+2],16)/255 for i in (1,3,5)]
    f = lambda c: c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b)
def contrast(l1, l2):
    hi, lo = max(l1,l2), min(l1,l2); return (hi+0.05)/(lo+0.05)

def slug(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')

# Consolidar estaciones únicas
by_article = {}
for L, sts in data.items():
    for idx, s in enumerate(sts, start=1):
        e = by_article.setdefault(s['article'], {'name': None, 'lines': [], 'order': {}})
        name = OVERRIDES.get(s['display'], s['display'])
        if e['name'] is None: e['name'] = name
        elif e['name'] != name:
            # Preferir la versión oficial si está en OVERRIDES
            if name in OVERRIDES.values(): e['name'] = name
        e['lines'].append(L); e['order'][L] = idx

LINE_ORDER = list(LINES.keys())
stations = []
for art, e in by_article.items():
    lat, lng = coords[art]
    lines_sorted = sorted(e['lines'], key=LINE_ORDER.index)
    stations.append({
        'id': slug(e['name']),
        'name': e['name'],
        'system': 'metro',
        'lines': lines_sorted,
        'transfer': len(lines_sorted) > 1,
        'lat': lat, 'lng': lng,
        'order': {L: e['order'][L] for L in lines_sorted},
        'wikidata': qids[art],
    })
stations.sort(key=lambda s: s['name'])
ids = [s['id'] for s in stations]
assert len(ids) == len(set(ids)), "IDs duplicados: " + str([i for i in ids if ids.count(i)>1])

# Terminales según orden oficial (posición 1 y última)
lines_out = {}
for L, info in LINES.items():
    sts = data[L]
    first = OVERRIDES.get(sts[0]['display'], sts[0]['display'])
    last  = OVERRIDES.get(sts[-1]['display'], sts[-1]['display'])
    lum = luminance(info['color'])
    text_dark = contrast(lum, 0.0) >= contrast(lum, 1.0)   # ¿negro contrasta mejor que blanco?
    # Señalética oficial usa blanco en rosa/rojo/naranja y el contraste con blanco sigue ≥ ~3:1
    if L in ('1', '6', '7'): text_dark = False
    entry = {
        'name': info['name'], 'color': info['color'],
        'textDark': text_dark, 'nick': info['nick'],
        'terminals': [first, last], 'stationCount': len(sts),
    }
    if 'color2' in info: entry['color2'] = info['color2']
    lines_out[L] = entry

out = {
    'meta': {
        'system': 'Sistema de Transporte Colectivo Metro, Ciudad de México',
        'generated': '2026-09-15',
        'sources': [
            'https://www.metro.cdmx.gob.mx/la-red (nombres, orden y colores oficiales)',
            'https://es.wikipedia.org (artículos por línea, cotejo de nombres y orden)',
            'https://www.wikidata.org (coordenadas GPS, propiedad P625)'
        ],
        'notes': 'Los 195 del STC cuentan cada estación una vez por línea; físicas únicas son 163. La ampliación de L12 a Observatorio no se incluye por estar en construcción.',
        'stationsPerLineTotal': sum(len(v) for v in data.values()),
        'uniqueStations': len(stations),
        'transferStations': sum(1 for s in stations if s['transfer']),
    },
    'lines': lines_out,
    'stations': stations,
}
dest = r'C:\Users\user\Documents\GSZ\Proyectos Personales\1. Ruta Metro\stations.json'
json.dump(out, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print("Escrito:", dest)
print()
print(f"{'Línea':9s} {'Color':9s} {'textDark':9s} {'#Est':5s} Terminales")
for L, e in lines_out.items():
    print(f"{e['name']:9s} {e['color']:9s} {str(e['textDark']):9s} {e['stationCount']:<5d} {e['terminals'][0]} ↔ {e['terminals'][1]}")
print()
print("Total estación-línea:", out['meta']['stationsPerLineTotal'])
print("Estaciones únicas:  ", out['meta']['uniqueStations'])
print("De transbordo:      ", out['meta']['transferStations'])
