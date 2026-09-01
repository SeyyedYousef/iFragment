import subprocess
import json

numbers_to_test = [
    # Royal & Genesis
    '88888888',
    '00000000',
    '8888',
    '8000',
    # Apex Mirror
    '12344321',
    '01233210',
    '80088008',
    '09900990',
    # Ladder Runs
    '12345678',
    '01234567',
    '98765432',
    '87654321',
    # Binary Dual
    '01010101',
    '80808080',
    '11001100',
    '77887788',
    # Famous Genesis
    '8001',
    '8002',
    '8003',
    '8004',
    '8005',
    '8008',
    '8800',
    '8880',
    '8777',
    '8999'
]

results = {}
for num in numbers_to_test:
    try:
        # Fragment URL: 4 digit is /number/888XXXX (e.g. 8888000) or /number/XXXX, 8 digit is /number/888XXXXXXXX or /number/XXXXXXXX
        # Let's check https://fragment.com/number/{num} and https://fragment.com/number/888{num}
        url1 = f"https://fragment.com/number/{num}"
        url2 = f"https://fragment.com/number/888{num}"
        
        out1 = subprocess.check_output(['curl.exe', '-s', '-I', '--max-time', '5', url1]).decode('utf-8', errors='ignore')
        out2 = subprocess.check_output(['curl.exe', '-s', '-I', '--max-time', '5', url2]).decode('utf-8', errors='ignore')
        
        status1 = out1.split('\n')[0].strip() if out1 else 'NONE'
        status2 = out2.split('\n')[0].strip() if out2 else 'NONE'
        
        results[num] = {
            'url1': status1,
            'url2': status2,
            'minted': ('200 OK' in status1 or '200 OK' in status2)
        }
    except Exception as e:
        results[num] = {'error': str(e)}

with open('scratch/fragment_check.json', 'w') as f:
    json.dump(results, f, indent=2)

print("Check finished. Minted summary:")
for k, v in results.items():
    print(f"{k}: {v.get('minted', False)} ({v.get('url1')}, {v.get('url2')})")
