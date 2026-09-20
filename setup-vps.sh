#!/bin/bash
# ==============================================================================
# iFragment VPS Turnkey Setup Script for Ubuntu 22.04 / 24.04 (Aeza 2GB RAM Edition)
# ==============================================================================

set -e

echo "🚀 [1/6] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git ufw htop ca-certificates gnupg nano debian-keyring debian-archive-keyring apt-transport-https

echo "🧠 [2/6] Configuring 4GB Swap memory (prevents Out-Of-Memory on 2GB VPS during Go builds)..."
if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl vm.swappiness=10
    grep -q 'vm.swappiness=10' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo "✅ Swap memory enabled (4GB)."
else
    echo "ℹ️ Swapfile already exists. Skipping."
fi

echo "🐳 [3/6] Installing Docker and Docker Compose..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installed successfully."
else
    echo "ℹ️ Docker is already installed."
fi

echo "🌐 [4/6] Installing and Configuring Caddy (Automatic HTTPS Reverse Proxy)..."
if ! command -v caddy &> /dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install -y caddy
    echo "✅ Caddy installed successfully."
else
    echo "ℹ️ Caddy is already installed."
fi

# Detect server public IPv4
SERVER_IP=$(curl -s4 ifconfig.me || curl -s4 icanhazip.com || echo "109.172.94.139")
SSLIP_DOMAIN="${SERVER_IP//./-}.sslip.io"

echo "🔧 Configuring Caddyfile for domain: $SSLIP_DOMAIN ..."
cat << CADDYEOF > /etc/caddy/Caddyfile
$SSLIP_DOMAIN {
    reverse_proxy localhost:8080
}
CADDYEOF

systemctl enable caddy
systemctl restart caddy
echo "✅ Caddy HTTPS reverse proxy running on https://$SSLIP_DOMAIN"

echo "📁 [5/6] Preparing application directories and volume permissions..."
mkdir -p /opt/ifragment
mkdir -p /opt/ifragment/backend/sessions /opt/ifragment/backend/uploads
# Docker user UID 10001 (appuser) permissions
chown -R 10001:10001 /opt/ifragment/backend/sessions /opt/ifragment/backend/uploads 2>/dev/null || true
echo "✅ Volumes initialized."

echo "🛡️ [6/6] Configuring firewall (UFW)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw --force enable
echo "✅ Firewall configured."

echo "=============================================================================="
echo "🎉 Server setup is complete! Your VPS is tuned and ready for iFragment."
echo "🔗 HTTPS Domain: https://$SSLIP_DOMAIN"
echo "👉 Next steps:"
echo "   1. cd /opt/ifragment"
echo "   2. cp .env.example .env && nano .env   (Fill your BOT_TOKEN and secrets)"
echo "   3. docker compose -f docker-compose.prod.yml up -d --build"
echo "   4. Test health: curl https://$SSLIP_DOMAIN/api/v1/healthz/ready"
echo "=============================================================================="
