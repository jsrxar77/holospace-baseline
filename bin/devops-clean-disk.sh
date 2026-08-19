#!/usr/bin/env bash
# ==============================================================================
# HOLOSPACE - LIMPIEZA DE ESPACIO EN DISCO EN SERVIDOR HETZNER
# ==============================================================================

SERVER_IP="5.161.237.189"
SERVER_USER="root"

echo "======================================================"
echo "🧹 Iniciando Limpieza de Docker en Servidor Hetzner ($SERVER_IP)..."
echo "======================================================"

ssh "$SERVER_USER@$SERVER_IP" "docker system prune -af --volumes=false"

echo ""
echo "--- 💽 Espacio Disponible tras Limpieza ---"
ssh "$SERVER_USER@$SERVER_IP" "df -h /"

echo ""
echo "======================================================"
echo "✔️ Limpieza Finalizada con Exito."
echo "======================================================"
