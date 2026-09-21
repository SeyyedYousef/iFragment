#!/usr/bin/env python3
"""
iFragment VPS One-Click Deployment Automation Script
Connects to Aeza VPS (109.172.94.139), pulls origin main, rebuilds Docker containers, and verifies health.
"""

import os
import sys
import time
import argparse

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

try:
    import paramiko
except ImportError:
    print("❌ Error: paramiko is required. Install with: pip install paramiko")
    sys.exit(1)

VPS_HOST = os.environ.get("VPS_HOST", "109.172.94.139")
VPS_PORT = int(os.environ.get("VPS_PORT", "22"))
VPS_USER = os.environ.get("VPS_USERNAME", "root")
VPS_PASS = os.environ.get("VPS_PASSWORD", "4PKa07cd4hzr")
APP_DIR = "/opt/ifragment"
COMPOSE_FILE = "docker-compose.prod.yml"
HEALTH_URL = "https://109-172-94-139.sslip.io/api/v1/healthz/ready"


def run_remote_command(client, cmd, label=None, stream=False):
    if label:
        print(f"\n🚀 [{label}] Running: {cmd}", flush=True)
    else:
        print(f"\n🔧 Running: {cmd}", flush=True)

    if stream:
        transport = client.get_transport()
        channel = transport.open_session()
        channel.exec_command(cmd)
        stdout_chunks = []
        stderr_chunks = []
        while not channel.exit_status_ready():
            if channel.recv_ready():
                chunk = channel.recv(1024).decode("utf-8", errors="replace")
                print(chunk, end="", flush=True)
                stdout_chunks.append(chunk)
            if channel.recv_stderr_ready():
                chunk = channel.recv_stderr(1024).decode("utf-8", errors="replace")
                print(chunk, end="", flush=True)
                stderr_chunks.append(chunk)
            time.sleep(0.3)
        code = channel.recv_exit_status()
        out = "".join(stdout_chunks)
        err = "".join(stderr_chunks)
        return code, out, err
    else:
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if out.strip():
            print(out.strip())
        if err.strip() and code != 0:
            print(f"⚠️ Warning/Error: {err.strip()}")
        return code, out, err


def main():
    parser = argparse.ArgumentParser(description="Deploy iFragment to Production VPS")
    parser.add_argument("--skip-git-pull", action="store_true", help="Skip git pull on VPS")
    parser.add_argument("--restart-only", action="store_true", help="Only restart containers without building")
    args = parser.parse_args()

    start_time = time.time()
    print("=" * 70)
    print(f"👑 iFragment VPS Automated Deployment")
    print(f"📡 Target: {VPS_USER}@{VPS_HOST}:{VPS_PORT}")
    print(f"📂 App Directory: {APP_DIR}")
    print("=" * 70)

    # 1. Connect to VPS
    print("🔌 Connecting to server via SSH...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VPS_HOST, port=VPS_PORT, username=VPS_USER, password=VPS_PASS, timeout=30)
        transport = client.get_transport()
        if transport:
            transport.set_keepalive(5)
        print("✅ Connected successfully to VPS (with TCP keepalive enabled)!")
    except Exception as e:
        print(f"❌ Failed to connect to VPS: {e}")
        sys.exit(1)

    try:
        # 2. Update .env safeguard
        run_remote_command(
            client,
            f"grep -q 'ALLOW_MOCK_CLIENT' {APP_DIR}/.env && sed -i 's/ALLOW_MOCK_CLIENT=.*/ALLOW_MOCK_CLIENT=true/' {APP_DIR}/.env || echo 'ALLOW_MOCK_CLIENT=true' >> {APP_DIR}/.env",
            label="1/5: Enforcing MTProto resilient fallback in .env"
        )

        # 3. Pull latest code
        if not args.skip_git_pull:
            code, out, _ = run_remote_command(
                client,
                f"cd {APP_DIR} && git pull origin main",
                label="2/5: Synchronizing latest code from GitHub (git pull origin main)"
            )
            if code != 0:
                print("⚠️ Git pull encountered issues, proceeding with existing code...")
        else:
            print("\n⏩ [2/5: Skipping git pull as requested]")

        # 4. Build and run containers
        if args.restart_only:
            run_remote_command(
                client,
                f"cd {APP_DIR} && docker compose -f {COMPOSE_FILE} restart api",
                label="3/5: Restarting API container"
            )
        else:
            code, _, _ = run_remote_command(
                client,
                f"cd {APP_DIR} && docker compose -f {COMPOSE_FILE} build api",
                label="3a/5: Building API container",
                stream=True
            )
            if code != 0:
                print("❌ Docker build failed!")
                sys.exit(code)

            code, _, _ = run_remote_command(
                client,
                f"cd {APP_DIR} && docker compose -f {COMPOSE_FILE} up -d",
                label="3b/5: Launching updated containers",
                stream=True
            )
            if code != 0:
                print("❌ Docker compose up failed!")
                sys.exit(code)

        # 5. Check container statuses
        print("\n🔍 [4/5: Checking running container statuses]...")
        time.sleep(3)
        _, out, _ = run_remote_command(
            client,
            f"docker compose -f {APP_DIR}/{COMPOSE_FILE} ps",
            label=None
        )

        # 6. Verify health endpoint
        print("\n🏥 [5/5: Verifying live API health endpoint]...")
        time.sleep(2)
        code, health_out, _ = run_remote_command(
            client,
            "curl -sf http://localhost:8080/api/v1/healthz/ready || curl -sf https://109-172-94-139.sslip.io/api/v1/healthz/ready || echo 'HEALTH_FAILED'",
            label=None
        )

        duration = round(time.time() - start_time, 1)
        print("\n" + "=" * 70)
        if "ready" in health_out.lower():
            print(f"🎉 DEPLOYMENT SUCCESSFUL in {duration}s!")
            print(f"🌐 Health endpoint response: {health_out.strip()}")
            print(f"🔗 Public URL: https://109-172-94-139.sslip.io")
            print("=" * 70)
        else:
            print(f"⚠️ Deployment completed in {duration}s, but health check returned: {health_out.strip()}")
            print("Check logs with: docker compose -f /opt/ifragment/docker-compose.prod.yml logs --tail 50 api")
            print("=" * 70)

    finally:
        client.close()


if __name__ == "__main__":
    main()
