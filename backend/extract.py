import re

with open(r'C:\Users\DEll\Desktop\iFragmentBot\src\Modules\Market\Domain\lexicon.domain.js', 'r', encoding='utf-8') as f:
    content = f.read()

def extract_tier(name):
    match = re.search(f'const {name} = `([^`]+)`', content)
    if match:
        words = match.group(1).split()
        return list(set([w.lower() for w in words]))
    return []

tiers = [
    'TIER_0_CORPORATE_GODS', 'TIER_1_ATLAS', 'TIER_2_WEALTH', 'TIER_3_PERSIAN',
    'TIER_3_RUSSIAN', 'TIER_3_ARABIC', 'TIER_3_CHINESE', 'TIER_3_LUCKY_NUMBERS',
    'TIER_3_TURKISH', 'TIER_4_NATURE', 'TIER_4_JOBS', 'TIER_4_TECH',
    'TIER_4_SOCIAL', 'TIER_4_VERBS', 'TIER_4_GAMING', 'TIER_4_FOOD',
    'TIER_4_CREATOR', 'TIER_4_MUSIC', 'TIER_4_SPORTS'
]

go_code = 'package avm\n\nvar (\n'

for t in tiers:
    words = extract_tier(t)
    go_code += f'\t{t.lower()} = map[string]struct{{}}{{\n'
    for w in words:
        go_code += f'\t\t"{w}": {{}},\n'
    go_code += '\t}\n\n'

def extract_array(name):
    match = re.search(f'const {name} = \\[\n(.*?)\n\\];', content, re.DOTALL)
    if match:
        items = re.findall(r"'([^']+)'", match.group(1))
        return list(set(items))
    return []

suffixes = extract_array('POWER_SUFFIXES')
go_code += '\tpowerSuffixes = []string{\n'
for s in suffixes:
    go_code += f'\t\t"{s}",\n'
go_code += '\t}\n\n'

prefixes = extract_array('POWER_PREFIXES')
go_code += '\tpowerPrefixes = []string{\n'
for p in prefixes:
    go_code += f'\t\t"{p}",\n'
go_code += '\t}\n\n'

go_code += ')\n'

with open(r'C:\Users\DEll\Desktop\iFragment\backend\internal\service\username\avm\lexicon_data.go', 'w', encoding='utf-8') as f:
    f.write(go_code)
print('Done writing lexicon_data.go')
