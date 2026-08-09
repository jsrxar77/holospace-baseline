#!/usr/bin/env bash
# devops-db-refresh.sh - Script de reseteo manteniendo la carpeta ./orders/ para carga de comprobantes

set -e

echo "======================================================"
echo "🧹 DevOps Database Refresh Tool"
echo "======================================================"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORDERS_DIR="$PROJECT_ROOT/orders"
USERS_FILE="$PROJECT_ROOT/users.json"

echo "📂 1. Asegurando carpeta ./orders/ para depósitos de comprobantes..."
mkdir -p "$ORDERS_DIR"
touch "$ORDERS_DIR/.gitkeep"

echo "👤 2. Conservando únicamente usuarios autorizados (Administrador Principal y Javier Rizzo)..."
cat << 'EOF' > "$USERS_FILE"
[
  {
    "id": "admin@drinklovers.com.ar",
    "email": "admin@drinklovers.com.ar",
    "password": "drinklovers2026!",
    "name": "Administrador Principal",
    "role": "ADMIN",
    "active": true
  },
  {
    "id": "jsrxar@gmail.com",
    "email": "jsrxar@gmail.com",
    "password": "Asadito21!",
    "name": "Javier Rizzo",
    "role": "OPERATOR",
    "active": true
  }
]
EOF

echo "🔄 3. Liberando puerto 3001 y reseteando la Base de Datos..."
npx -y kill-port 3001 2>/dev/null || true

echo ""
echo "✅ ¡BASE DE DATOS RESETEADA Y CONSERVANDO ÚNICAMENTE LOS 2 USUARIOS AUTORIZADOS!"
echo "1. Administrador Principal (admin@drinklovers.com.ar)"
echo "2. Javier Rizzo (jsrxar@gmail.com)"
echo "======================================================"
