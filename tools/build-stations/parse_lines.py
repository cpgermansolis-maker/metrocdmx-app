import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')

LINES = ['1','2','3','4','5','6','7','8','9','A','B','12']
result = {}

for L in LINES:
    t = json.load(open(f'linea_{L}.json', encoding='utf-8'))['parse']['wikitext']
    # Locate the "Estaciones" section and its first wikitable
    i = t.find('== Estaciones')
    if i < 0:
        i = t.find('==Estaciones')
    sec = t[i:]
    start = sec.find('{|')
    end = sec.find('|}', start)
    table = sec[start:end]
    rows = table.split('|-')
    stations = []
    for r in rows[1:]:  # skip header
        m = re.search(r"\|\s*'''\[\[([^\]|]+)(?:\|([^\]]+))?\]\]'''", r)
        if not m:
            continue
        article = m.group(1).strip()
        display = (m.group(2) or m.group(1)).strip()
        # Correspondence lines: look for "MetroDF Línea X.svg"
        corr = re.findall(r'MetroDF L[íi]nea ([0-9AB]+)\.svg', r)
        corr = [c for c in dict.fromkeys(corr) if c != L]
        stations.append({'article': article, 'display': display, 'corr': corr})
    result[L] = stations
    print(f"Línea {L}: {len(stations)} estaciones  [{stations[0]['display']} → {stations[-1]['display']}]")

json.dump(result, open('parsed_lines.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
print("Total filas (con repetidos por transbordo):", sum(len(v) for v in result.values()))
