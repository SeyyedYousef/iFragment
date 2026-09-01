import subprocess
import json

candidates = [
    # Genesis Candidates
    '8000', '8001', '8002', '8003', '8004', '8005', '8006', '8007', '8008', '8009',
    '8888', '8800', '8880', '8088', '8777', '8999', '8111', '8222', '8333', '8444', '8555', '8666',
    # 8-digit Mirror & Symmetric
    '01233210', '09900990', '08800880', '07700770', '05500550', '01100110', '02200220',
    # 8-digit Ladder & Sequences
    '01234567', '07654321', '08765432', '09876543',
    # 8-digit Binary & Dual
    '01010101', '02020202', '03030303', '04040404', '05050505', '06060606', '07070707', '08080808', '09090909',
    '00000000', '00008888', '08888888', '08880888', '00001111', '00002222'
]

verified_minted = []
for num in candidates:
    try:
        url = f"https://fragment.com/number/888{num}"
        out = subprocess.check_output(['curl.exe', '-s', '-I', '--max-time', '3', url]).decode('utf-8', errors='ignore')
        first_line = out.split('\n')[0].strip() if out else ''
        if '200 OK' in first_line:
            verified_minted.append(num)
            print(f"MINTED: {num} -> {url}")
    except:
        pass

print("\n--- ALL VERIFIED MINTED NUMBERS ---")
print(json.dumps(verified_minted, indent=2))
