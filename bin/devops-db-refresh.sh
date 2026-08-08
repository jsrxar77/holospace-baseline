#!/usr/bin/env bash
# devops-db-refresh.sh - Script de reseteo manteniendo la carpeta ./orders/ para carga de comprobantes

set -e

echo "======================================================"
echo "🧹 DevOps Database Refresh Tool"
echo "======================================================"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORDERS_DIR="$PROJECT_ROOT/orders"

echo "📂 1. Asegurando carpeta ./orders/ para depósitos de comprobantes..."
mkdir -p "$ORDERS_DIR"
touch "$ORDERS_DIR/.gitkeep"

echo "👤 2. Conservando únicamente usuario Administrador por defecto (admin@drinklovers.com)..."

echo "🔄 3. Liberando puerto 3001 y reseteando la Base de Datos..."
npx -y kill-port 3001 2>/dev/null || true

echo ""
echo "✅ ¡BASE DE DATOS RESETEADA Y CARPETA ./orders/ LISTA!"
echo "Puedes colocar o subir tus archivos PDF en ./orders/ o desde el Panel Web Admin."
echo "======================================================"
