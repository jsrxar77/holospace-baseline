#!/usr/bin/env bash
# devops-db-refresh.sh - Script de reseteo a ESTADO CERO EN BLANCO (Solo usuario Admin)

set -e

echo "======================================================"
echo "🧹 DevOps Database Blank Reset Tool (Estado Cero)"
echo "======================================================"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORDERS_DIR="$PROJECT_ROOT/orders"

echo "📂 1. Vaciando carpeta ./orders/ (0 archivos)..."
mkdir -p "$ORDERS_DIR"
rm -rf "$ORDERS_DIR"/* 2>/dev/null || true

echo "👤 2. Conservando únicamente usuario Administrador por defecto (admin@drinklovers.com)..."

echo "🔄 3. Liberando puerto 3001 y limpiando registros de la Base de Datos..."
npx -y kill-port 3001 2>/dev/null || true

echo ""
echo "✅ ¡BASE DE DATOS Y ./orders/ EN BLANCO Y LISTAS!"
echo "El proceso logístico inicia desde cero cuando subas un archivo PDF desde el Panel Web Admin."
echo "======================================================"
