#!/usr/bin/env python3
"""
iFragment VPS Quick Status and Health Check Script
Connects to VPS, inspects docker containers, memory usage, and live API endpoints.
"""

import os
import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = os.environ.get("VPS_HOST", "109.172.94.139")
VPS_PORT = int(os.environ.get("VPS_PORT", "22"))
VPS_USER = os.environ.get("VPS_USERNAME", "root")
VPS_PASS = os.environ.get("VPS_PASSWORD", "4PKa07cd4hzr")
APP_DIR = "/opt/ifragment"
COMPOSE_FILE = "docker-compose.prod.yml"

print(f"🔌 Connecting to {VPS_HOST}...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(VPS_HOST, port=VPS_PORT, username=VPS_USER, password=VPS_PASS, timeout=15)
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

try:
    # 1. System Info
    print("\n📊 --- System Memory & Uptime ---")
    _, out, _ = client.exec_command("uptime; echo ''; free -h")
    print(out.read().decode('utf-8', errors='replace'))

    # 2. Git Version
    print("🔖 --- Production Git Commit ---")
    _, out, _ = client.exec_command(f"cd {APP_DIR} && git log -1 --oneline")
    print(out.read().decode('utf-8', errors='replace'))

    # 3. Docker Containers
    print("🐳 --- Docker Containers Status ---")
    _, out, _ = client.exec_command(f"docker compose -f {APP_DIR}/{COMPOSE_FILE} ps")
    print(out.read().decode('utf-8', errors='replace'))

    # 4. Endpoints Check
    print("🌐 --- Live Endpoints Verification ---")
    endpoints = [
        "/api/v1/healthz/ready",
        "/api/v1/numbers/collection-overview",
        "/api/v1/numbers/patterns"
    ]
    for ep in endpoints:
        _, out, _ = client.exec_command(f"curl -s http://localhost:8080{ep} | head -c 200")
        res = out.read().decode('utf-8', errors='replace')
        print(f"  {ep} -> {res[:120]}...")

finally:
    client.close()
    print("\n✅ VPS status check complete.")
