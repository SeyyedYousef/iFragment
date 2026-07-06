import re
import os
import math

file_path = r"C:\Users\DEll\Desktop\iFragment\backend\internal\service\username\avm\historical_sales.go"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

def round_float(match):
    key = match.group(1)
    val = float(match.group(2))
    # Round to 1 decimal place to ensure ".0" format if it was whole
    rounded_val = float(round(val))
    return f'"{key}": {rounded_val:.1f},'

# regex to find map entries: "something": 123.456,
new_content = re.sub(r'"([^"]+)":\s+([\d\.]+),', round_float, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Finished cleaning historical_sales.go")
