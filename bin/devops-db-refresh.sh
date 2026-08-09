#!/usr/bin/env bash
# devops-db-refresh.sh - Script de reseteo de usuarios y puerto sin tocar ningún directorio del filesystem

set -e

echo "======================================================"
echo "🧹 DevOps Database Refresh Tool"
echo "======================================================"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USERS_FILE="$PROJECT_ROOT/users.json"

echo "👤 1. Estableciendo únicamente usuarios autorizados en users.json..."
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

echo "🔄 2. Liberando puerto 3001..."
npx -y kill-port 3001 2>/dev/null || true

echo ""
echo "✅ ¡BASE DE DATOS Y USUARIOS RESETEADOS CORRECTAMENTE!"
echo "1. Administrador Principal (admin@drinklovers.com.ar)"
echo "2. Javier Rizzo (jsrxar@gmail.com)"
echo "======================================================"
