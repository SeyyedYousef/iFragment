import os
import re
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

files = [
    r'backend/internal/handler/webhook_bot_flow.go',
    r'backend/internal/handler/webhook.go',
    r'backend/internal/handler/admin_panel.go',
    r'backend/internal/handler/webhook_gifts.go'
]

arabic_regex = re.compile(r'[\u0600-\u06FF]')

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    current_case = None
    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        case_match = re.search(r'case\s+"([a-zA-Z0-9_-]+)"', stripped)
        if case_match:
            current_case = case_match.group(1)
        elif stripped.startswith("default:") or (stripped.startswith("case ") and not case_match):
            current_case = None

        if current_case in ['ru', 'zh', 'en']:
            matches = arabic_regex.findall(line)
            if matches:
                # print escaped representation if needed
                print(f"{fpath}:{idx} [case {current_case}] matches={matches}: {repr(line.strip())}")
