#!/usr/bin/env bash
# ==============================================================================
# HOLOSPACE - EJECUTAR COMANDO REMOTO EN HETZNER
# ==============================================================================

SERVER_IP="5.161.237.189"
SERVER_USER="root"

if [ -z "$1" ]; then
    echo "Uso: $0 \"comando a ejecutar\""
    exit 1
fi

ssh "$SERVER_USER@$SERVER_IP" "$@"
