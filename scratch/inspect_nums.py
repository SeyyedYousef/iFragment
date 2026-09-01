import subprocess
import re

out = subprocess.check_output(['curl.exe', '-s', '--max-time', '15', 'https://nums888.io/numbers/']).decode('utf-8', errors='ignore')
links = [m.start() for m in re.finditer(r'href="/numbers/\d+/"', out)]
print("Numbers found count:", len(links))

if links:
    first_idx = links[0]
    # Save the container snippet around it
    with open('scratch/snippet.html', 'w', encoding='utf-8') as f:
        f.write(out[max(0, first_idx - 500) : min(len(out), first_idx + 2500)])
    print("Saved snippet to scratch/snippet.html")
