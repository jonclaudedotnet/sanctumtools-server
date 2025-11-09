#!/bin/bash

# Quick Deploy Script for SanctumTools to EC2
# Usage: ./quick-deploy.sh

set -e

echo "🚀 SanctumTools EC2 Quick Deploy"
echo "=================================="
echo ""

# Configuration
EC2_USER="ec2-user"
EC2_HOST="3.85.53.217"
EC2_REGION="us-east-1"
APP_DIR="/opt/sanctumtools-server"
INSTANCE_ID="i-0c841e020508e7227"

# Find SSH key
echo "🔍 Looking for SSH key..."
KEY_FILE=""

# Try common key locations
for key in ~/.ssh/sanctumtools.pem ~/.ssh/id_rsa ~/.ssh/ec2-key.pem; do
    if [ -f "$key" ]; then
        KEY_FILE="$key"
        echo "✓ Found key: $KEY_FILE"
        break
    fi
done

if [ -z "$KEY_FILE" ]; then
    echo "❌ No SSH key found!"
    echo ""
    echo "Please specify your SSH key:"
    echo "  - sanctumtools.pem"
    echo "  - id_rsa"
    echo "  - ec2-key.pem"
    echo ""
    read -p "Enter the path to your SSH key: " KEY_FILE

    if [ ! -f "$KEY_FILE" ]; then
        echo "❌ Key file not found: $KEY_FILE"
        exit 1
    fi
fi

# Fix key permissions if needed
chmod 400 "$KEY_FILE" 2>/dev/null || true

echo ""
echo "🔐 Connecting to EC2 instance..."
echo "   Host: $EC2_HOST"
echo "   User: $EC2_USER"
echo "   Key: $KEY_FILE"
echo ""

# Run deployment commands via SSH
ssh -i "$KEY_FILE" "$EC2_USER@$EC2_HOST" << 'REMOTE_COMMANDS'

echo "📦 Step 1: Create app directory"
sudo mkdir -p /opt/sanctumtools-server
sudo chown ec2-user:ec2-user /opt/sanctumtools-server
cd /opt/sanctumtools-server

echo ""
echo "📥 Step 2: Clone/update repository"
if [ -d ".git" ]; then
    echo "  Repository already cloned, pulling latest..."
    git pull origin master
else
    echo "  Cloning repository..."
    git clone https://github.com/jonclaudedotnet/jc-gon-bring-it-to-ya.git . 2>/dev/null || \
    git clone https://github.com/YOUR_REPO/sanctumtools-server.git .
    cd sanctumtools-server 2>/dev/null || cd .
fi

echo ""
echo "⚙️  Step 3: Check Node.js installation"
if ! command -v node &> /dev/null; then
    echo "  Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "  ✓ Node.js $(node --version) is installed"
fi

echo ""
echo "📚 Step 4: Install dependencies"
npm install --production

echo ""
echo "⚙️  Step 5: Setup systemd service"
sudo cp sanctumtools.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sanctumtools

echo ""
echo "🚀 Step 6: Start the service"
sudo systemctl start sanctumtools

echo ""
echo "✅ Step 7: Verify service is running"
sleep 2
sudo systemctl status sanctumtools

echo ""
echo "🔍 Step 8: Check if port 3000 is listening"
sleep 1
sudo netstat -tlnp | grep 3000 || echo "  (Port check may show no output initially)"

echo ""
echo "📋 Step 9: View recent logs"
sudo journalctl -u sanctumtools -n 20 --no-pager

REMOTE_COMMANDS

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🌐 Your app should now be available at:"
echo "   https://my.sanctumtools.com/forgot-password"
echo ""
echo "📊 To view logs in real-time, SSH and run:"
echo "   sudo journalctl -u sanctumtools -f"
echo ""
echo "🔄 To restart the service:"
echo "   ssh -i \"$KEY_FILE\" $EC2_USER@$EC2_HOST 'sudo systemctl restart sanctumtools'"
echo ""
