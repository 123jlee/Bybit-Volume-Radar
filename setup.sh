#!/bin/bash
echo "Starting Bybit Volume Radar Setup..."

# Update and Install Nginx
echo "Updating packages..."
apt-get update
echo "Installing Nginx..."
apt-get install -y nginx

# Setup Config
echo "Configuring Nginx..."
cp /home/admin/bybit-radar/bybit-radar.conf /etc/nginx/sites-available/bybit-radar
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/bybit-radar /etc/nginx/sites-enabled/

# Setup Content in /var/www (Fixes permissions 500 error)
echo "Moving files to /var/www..."
mkdir -p /var/www/bybit-radar
cp -r /home/admin/bybit-radar/* /var/www/bybit-radar/

# Permissions
echo "Setting permissions..."
chown -R www-data:www-data /var/www/bybit-radar
chmod -R 755 /var/www/bybit-radar

# Restart Nginx
echo "Restarting Nginx..."
nginx -t && systemctl restart nginx

echo "✅ Deployment Complete! Visit http://91.98.137.192 to view the app."
