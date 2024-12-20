#!/bin/bash
set -e

# Ensure nginx proxy is properly configured
if [ ! -f /etc/nginx/conf.d/proxy.conf ]; then
    echo "Configuring nginx proxy..."
    cat << 'EOF' > /etc/nginx/conf.d/proxy.conf
upstream docker {
    server 127.0.0.1:8081;
    keepalive 256;
}
EOF
fi 