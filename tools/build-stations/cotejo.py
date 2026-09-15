import re, json, sys, unicodedata
sys.stdout.reconfigure(encoding='utf-8')

def norm(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s.lower())

wiki = json.load(open('parsed_lines.json', encoding='utf-8'))
files = {'1':'oficial_l1.html','2':'oficial_l2.html','3':'oficial_l3.html','4':'oficial_l4.html',
         '5':'oficial_l5.html','6':'oficial_l6.html','7':'oficial_l7.html','8':'oficial_l8.html',
         '9':'oficial_l9.html','A':'oficial_la.html','B':'oficial_lb.html','12':'oficial_l12.html'}

official = {}
for L, f in files.items():
    h = open(f, encoding='utf-8', errors='replace').read()
    txt = re.sub(r'<[^>]+>', ' ', h)
    txt = txt.replace('&nbsp;', ' ')
    txt = re.sub(r'\s+', ' ', txt)
    # The station list is between "Total de estaciones" and "Inauguraciones"
    a = txt.find('Total de estaciones'); b = txt.find('Inauguraciones', a)
    seg = txt[a:b] if a >= 0 and b > a else txt
    # Pattern: number followed by UPPERCASE NAME (letters, spaces, accents, / . ' numbers)
    m = re.findall(r'(?<![\d.])(\d{1,2}) ([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ0-9 /\.\'-]{2,}?)(?= Estación| Ubicada| Es una| \d{1,2} |$)', seg)
    names = [n.strip() for _, n in m]
    official[L] = names
    total = re.search(r'Total de estaciones:\s*(\d+)', txt)
    print(f"L{L}: portal dice total={total.group(1) if total else '?'} | parseadas={len(names)} | wiki={len(wiki[L])}")

print()
print("=== COTEJO nombre por nombre (orden) ===")
diffs = 0
for L in files:
    w = [s['display'] for s in wiki[L]]
    o = official[L]
    if [norm(x) for x in w] == [norm(x) for x in o]:
        print(f"L{L}: ✓ idéntico ({len(w)} estaciones)")
    elif [norm(x) for x in w] == [norm(x) for x in o[::-1]]:
        print(f"L{L}: ✓ idéntico pero en orden inverso ({len(w)})")
    else:
        diffs += 1
        print(f"L{L}: ✗ DIFERENCIAS")
        for i in range(max(len(w), len(o))):
            ww = w[i] if i < len(w) else '—'
            oo = o[i] if i < len(o) else '—'
            flag = '' if norm(ww) == norm(oo) else '   <<<'
            print(f"    {i+1:2d}. wiki={ww:32s} portal={oo}{flag}")
json.dump(official, open('official_names.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
