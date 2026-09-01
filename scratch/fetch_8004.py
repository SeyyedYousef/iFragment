import subprocess
import re

out = subprocess.check_output(['curl.exe', '-s', '--max-time', '15', 'https://nums888.io/numbers/?mask=8004']).decode('utf-8', errors='ignore')
with open('scratch/nums888_8004.html', 'w', encoding='utf-8') as f:
    f.write(out)

print("Saved nums888_8004.html. Total length:", len(out))

# Also check single number page https://nums888.io/numbers/8888004/
out_single = subprocess.check_output(['curl.exe', '-s', '--max-time', '15', 'https://nums888.io/numbers/8888004/']).decode('utf-8', errors='ignore')
with open('scratch/nums888_single_8004.html', 'w', encoding='utf-8') as f:
    f.write(out_single)
print("Saved nums888_single_8004.html. Total length:", len(out_single))
