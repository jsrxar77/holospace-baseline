#!/usr/bin/env bash
# ==============================================================================
# HOLOSPACE - VERIFICAR ESTADO DEL SERVIDOR HETZNER
# ==============================================================================

SERVER_IP="5.161.237.189"
SERVER_USER="root"

echo "======================================================"
echo "🔍 Conectando con Servidor Hetzner ($SERVER_IP)..."
echo "======================================================"

echo ""
echo "--- 💾 Estado de la Memoria RAM ---"
ssh "$SERVER_USER@$SERVER_IP" "free -h"

echo ""
echo "--- 💽 Estado del Espacio en Disco ---"
ssh "$SERVER_USER@$SERVER_IP" "df -h /"

echo ""
echo "--- 🐋 Contenedores Docker Activos (HoloSpace & otros) ---"
ssh "$SERVER_USER@$SERVER_IP" "docker ps --format 'table {{.Names}}	{{.Status}}	{{.Ports}}'"

echo ""
echo "======================================================"
echo "✔️ Consulta Finalizada con Exito."
echo "======================================================"
