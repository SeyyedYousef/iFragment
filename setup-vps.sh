#!/bin/bash
# ==============================================================================
# iFragment VPS One-Click Setup Script for Ubuntu 22.04 / 24.04 (2GB RAM Edition)
# ==============================================================================

set -e

echo "🚀 [1/4] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git ufw htop ca-certificates gnupg

echo "🧠 [2/4] Configuring 2GB Swap memory (prevents Out-Of-Memory on 2GB VPS)..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo "✅ Swap memory enabled (2GB)."
else
    echo "ℹ️ Swapfile already exists. Skipping."
fi

echo "🐳 [3/4] Installing Docker and Docker Compose..."
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

echo "🛡️ [4/4] Configuring basic firewall (UFW)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw --force enable

echo "=============================================================================="
echo "🎉 Server setup is complete! Your 2GB VPS is tuned and ready for iFragment."
echo "👉 Next step: copy .env.example to .env, edit your secrets, then run:"
echo "   docker compose -f docker-compose.prod.yml up -d --build"
echo "=============================================================================="
