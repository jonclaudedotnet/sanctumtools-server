#!/bin/bash
set -e

echo "🚀 Deploying SanctumTools to EC2..."

# Stop the service if running
sudo systemctl stop sanctumtools || true

# Create app directory
sudo mkdir -p /opt/sanctumtools-server
sudo chown ec2-user:ec2-user /opt/sanctumtools-server

# Copy code to EC2
cp -r . /opt/sanctumtools-server/

# Install dependencies
cd /opt/sanctumtools-server
npm install --production

# Copy systemd service
sudo cp sanctumtools.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable sanctumtools
sudo systemctl start sanctumtools

# Check status
sudo systemctl status sanctumtools

echo "✅ Deployment complete!"
echo "App should be running on port 3000"
echo ""
echo "View logs with: sudo journalctl -u sanctumtools -f"
