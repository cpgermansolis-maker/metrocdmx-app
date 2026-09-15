import json, sys, urllib.parse, subprocess
sys.stdout.reconfigure(encoding='utf-8')
data = json.load(open('parsed_lines.json', encoding='utf-8'))
articles = sorted({s['article'] for sts in data.values() for s in sts})
UA = "MetroCDMX-PWA/1.0 (contacto: cpgermansolis@gmail.com)"

# Step 1: article -> Wikidata QID
qids = {}
for i in range(0, len(articles), 50):
    batch = articles[i:i+50]
    titles = urllib.parse.quote('|'.join(batch))
    url = f"https://es.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&titles={titles}&format=json&formatversion=2&redirects=1"
    d = json.loads(subprocess.run(['curl','-s','-A',UA,url], capture_output=True).stdout.decode('utf-8'))
    redir = {r['to']: r['from'] for r in d['query'].get('redirects', [])}
    for p in d['query']['pages']:
        orig = redir.get(p['title'], p['title'])
        qids[orig] = p.get('pageprops', {}).get('wikibase_item')
print("Con QID:", sum(1 for v in qids.values() if v), "/", len(articles))

# Step 2: QID -> coordinates (P625) via wbgetentities
q2a = {v: k for k, v in qids.items() if v}
coords = {}
ids = list(q2a.keys())
for i in range(0, len(ids), 50):
    batch = ids[i:i+50]
    url = f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={'|'.join(batch)}&props=claims&format=json"
    d = json.loads(subprocess.run(['curl','-s','-A',UA,url], capture_output=True).stdout.decode('utf-8'))
    for qid, ent in d['entities'].items():
        cl = ent.get('claims', {}).get('P625')
        if cl:
            v = cl[0]['mainsnak']['datavalue']['value']
            coords[q2a[qid]] = (round(v['latitude'], 5), round(v['longitude'], 5))
missing = [a for a in articles if a not in coords]
print("Con coordenadas Wikidata:", len(coords))
print("Faltan:", missing)
json.dump({'qids': qids, 'coords': coords}, open('wikidata.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
