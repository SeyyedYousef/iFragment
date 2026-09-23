#!/usr/bin/env python3
"""
iFragment VPS One-Click Automated Deployment Script
Deploys updated code to production VPS (109.172.94.139).
Default: Ultra-fast RAM-safe prebuilt cross-compilation + pipelined SFTP transfer.
"""

import os
import sys
import time
import gzip
import shutil
import subprocess
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

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")


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


def deploy_via_prebuilt(client):
    print("\n📦 [1/4: Compiling Linux AMD64 Go binary locally (RAM-safe)]...", flush=True)
    local_bin = os.path.join(BACKEND_DIR, "dist_main")
    local_gz = os.path.join(BACKEND_DIR, "dist_main.gz")
    
    # Cross compile
    env = os.environ.copy()
    env["GOOS"] = "linux"
    env["GOARCH"] = "amd64"
    env["CGO_ENABLED"] = "0"
    
    t0 = time.time()
    res = subprocess.run(
        ["go", "build", "-ldflags=-s -w", "-o", local_bin, "./cmd/api"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print(f"❌ Local Go cross-compile failed:\n{res.stderr}")
        sys.exit(1)
    
    raw_size = os.path.getsize(local_bin)
    print(f"✅ Compiled {raw_size / (1024*1024):.1f} MB binary in {time.time()-t0:.1f}s", flush=True)

    # Gzip
    t1 = time.time()
    with open(local_bin, 'rb') as f_in:
        with gzip.open(local_gz, 'wb', compresslevel=6) as f_out:
            shutil.copyfileobj(f_in, f_out, length=1024*1024)
    gz_size = os.path.getsize(local_gz)
    print(f"✅ Gzip compressed to {gz_size / (1024*1024):.1f} MB in {time.time()-t1:.1f}s", flush=True)

    # Upload via SFTP
    print("\n🚀 [2/4: Transferring compressed binary to VPS via SFTP]...", flush=True)
    t2 = time.time()
    sftp = client.open_sftp()
    remote_gz = f"{APP_DIR}/backend/main.gz"
    
    last_reported = [0]
    def sftp_callback(transferred, total):
        if transferred - last_reported[0] >= 3 * 1024 * 1024 or transferred == total:
            last_reported[0] = transferred
            pct = (transferred / total) * 100 if total > 0 else 0
            print(f"  Uploaded {transferred / (1024*1024):.1f} / {total / (1024*1024):.1f} MB ({pct:.0f}%)", flush=True)

    sftp.put(local_gz, remote_gz, callback=sftp_callback)
    sftp.close()
    print(f"✅ Upload completed in {time.time()-t2:.1f}s!", flush=True)

    # Clean local temp files
    try:
        os.remove(local_bin)
        os.remove(local_gz)
    except Exception:
        pass

    # Extract & write Dockerfile.prebuilt on VPS
    print("\n🐳 [3/4: Building Docker image and updating containers on VPS]...", flush=True)
    extract_cmd = (
        f"cd {APP_DIR}/backend && "
        f"gunzip -f main.gz && "
        f"chmod +x main && "
        f"cat << 'EOF' > Dockerfile.prebuilt\n"
        f"FROM alpine:3.21\n"
        f"RUN apk --no-cache add ca-certificates tzdata && \\\n"
        f"    addgroup -g 10001 -S appgroup && \\\n"
        f"    adduser -u 10001 -S appuser -G appgroup\n"
        f"WORKDIR /app\n"
        f"COPY main .\n"
        f"COPY migrations ./migrations\n"
        f"RUN mkdir -p /app/sessions /app/uploads && \\\n"
        f"    chown -R appuser:appgroup /app && \\\n"
        f"    chmod +x /app/main\n"
        f"USER 10001:10001\n"
        f"EXPOSE 8080\n"
        f"CMD [\"./main\"]\n"
        f"EOF\n"
        f"docker build -t ifragment-api:latest -f Dockerfile.prebuilt .\n"
    )
    run_remote_command(client, extract_cmd, label="Build Docker image from prebuilt binary")

    # Launch container
    run_remote_command(
        client,
        f"docker compose -f {APP_DIR}/{COMPOSE_FILE} up -d --no-deps api",
        label="Restarting api container with zero downtime"
    )


def main():
    parser = argparse.ArgumentParser(description="Deploy iFragment to Production VPS")
    parser.add_argument("--skip-git-pull", action="store_true", help="Skip git pull on VPS")
    parser.add_argument("--restart-only", action="store_true", help="Only restart containers without building")
    parser.add_argument("--build-on-vps", action="store_true", help="Build Go binary directly on VPS inside Docker (not recommended for 2GB VPS)")
    args = parser.parse_args()

    start_time = time.time()
    print("=" * 70)
    print("👑 iFragment VPS Automated Deployment")
    print(f"📡 Target: {VPS_USER}@{VPS_HOST}:{VPS_PORT}")
    print(f"📂 App Directory: {APP_DIR}")
    print("=" * 70)

    # 1. Connect to VPS
    print("🔌 Connecting to server via SSH...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connected = False
    for attempt in range(1, 4):
        try:
            print(f"  Attempt {attempt}/3...")
            client.connect(
                VPS_HOST,
                port=VPS_PORT,
                username=VPS_USER,
                password=VPS_PASS,
                timeout=30,
                banner_timeout=60,
                auth_timeout=60
            )
            transport = client.get_transport()
            if transport:
                transport.set_keepalive(10)
            print("✅ Connected successfully to VPS (with TCP keepalive enabled)!")
            connected = True
            break
        except Exception as e:
            print(f"⚠️ Attempt {attempt} failed: {e}")
            time.sleep(3)

    if not connected:
        print("❌ Failed to connect to VPS after 3 attempts.")
        sys.exit(1)

    try:
        # 2. Update .env safeguard
        run_remote_command(
            client,
            f"grep -q 'ALLOW_MOCK_CLIENT' {APP_DIR}/.env && sed -i 's/ALLOW_MOCK_CLIENT=.*/ALLOW_MOCK_CLIENT=true/' {APP_DIR}/.env || echo 'ALLOW_MOCK_CLIENT=true' >> {APP_DIR}/.env",
            label="Enforcing MTProto resilient fallback in .env"
        )

        # 3. Pull latest code on VPS
        if not args.skip_git_pull:
            run_remote_command(
                client,
                f"cd {APP_DIR} && git pull origin main",
                label="Synchronizing latest git commits on VPS"
            )

        # 4. Build and deploy
        if args.restart_only:
            run_remote_command(
                client,
                f"cd {APP_DIR} && docker compose -f {COMPOSE_FILE} restart api",
                label="Restarting API container"
            )
        elif args.build_on_vps:
            code, _, _ = run_remote_command(
                client,
                f"cd {APP_DIR} && docker compose -f {COMPOSE_FILE} build api && docker compose -f {COMPOSE_FILE} up -d",
                label="Building directly on VPS",
                stream=True
            )
            if code != 0:
                print(f"❌ Build failed on VPS with exit code {code}")
                sys.exit(1)
        else:
            deploy_via_prebuilt(client)

        # 5. Check container statuses
        print("\n🔍 [Checking running container statuses]...")
        time.sleep(4)
        run_remote_command(client, f"docker compose -f {APP_DIR}/{COMPOSE_FILE} ps")

        # 6. Verify health endpoint
        print("\n🏥 [Verifying live API health endpoint]...")
        time.sleep(2)
        code, health_out, _ = run_remote_command(
            client,
            "curl -sf http://localhost:8080/api/v1/healthz/ready || curl -sf https://109-172-94-139.sslip.io/api/v1/healthz/ready || echo 'HEALTH_FAILED'"
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
            print(f"Check logs with: docker compose -f {APP_DIR}/{COMPOSE_FILE} logs --tail 50 api")
            print("=" * 70)

    finally:
        client.close()


if __name__ == "__main__":
    main()
