with open('scratch/nums888_single_8004.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
banned_matches = re.findall(r'.{0,100}(?:banned|restrict|status).{0,100}', text, re.IGNORECASE)
print("Matches in single page:", len(banned_matches))
for m in banned_matches[:10]:
    print("MATCH:", m.strip())
