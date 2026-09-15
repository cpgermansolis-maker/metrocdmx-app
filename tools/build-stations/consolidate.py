import json, sys
sys.stdout.reconfigure(encoding='utf-8')
data = json.load(open('parsed_lines.json', encoding='utf-8'))

# Group by article title (unique physical station)
by_article = {}
for L, sts in data.items():
    for idx, s in enumerate(sts, start=1):
        a = s['article']
        e = by_article.setdefault(a, {'displays': set(), 'lines': {}, 'corr_claimed': {}})
        e['displays'].add(s['display'])
        e['lines'][L] = idx
        e['corr_claimed'][L] = s['corr']

print("Estaciones únicas (por artículo):", len(by_article))
print()
# Symmetry check: what each line's table claims vs actual membership
problems = 0
for a, e in sorted(by_article.items()):
    actual = set(e['lines'].keys())
    for L, corr in e['corr_claimed'].items():
        claimed = set(corr) | {L}
        if claimed != actual:
            problems += 1
            print(f"  ⚠ {a}: desde L{L} dice {sorted(claimed)} pero membresía real {sorted(actual)}")
print("Inconsistencias de correspondencia:", problems)
print()
# Display-name variations
print("Estaciones con más de un nombre de display:")
for a, e in sorted(by_article.items()):
    if len(e['displays']) > 1:
        print(f"  {a}: {sorted(e['displays'])}")
print()
print("Transbordos (más de una línea):")
for a, e in sorted(by_article.items()):
    if len(e['lines']) > 1:
        print(f"  {list(e['displays'])[0]}: {sorted(e['lines'].keys())}")
