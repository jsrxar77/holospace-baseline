#!/usr/bin/env bash
# devops-db-refresh.sh - Script de reseteo de Base de Datos SQLite (phoneware.db) conservando únicamente los 2 usuarios autorizados

set -e

echo "======================================================"
echo "🧹 DevOps Database Refresh Tool (SQLite phoneware.db)"
echo "======================================================"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"
DB_FILE="$DATA_DIR/phoneware.db"
USERS_FILE="$PROJECT_ROOT/users.json"

echo "📂 1. Asegurando directorio ./data/..."
mkdir -p "$DATA_DIR"

echo "🗑️ 2. Eliminando archivo de Base de Datos SQLite antiguo (phoneware.db)..."
rm -f "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm"

echo "👤 3. Estableciendo únicamente usuarios autorizados en users.json..."
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

echo "🔄 4. Liberando puerto 3001..."
npx -y kill-port 3001 2>/dev/null || true

echo ""
echo "✅ ¡BASE DE DATOS SQLITE Y USUARIOS RESETEADOS CORRECTAMENTE!"
echo "📍 Archivo de DB: ./data/phoneware.db"
echo "1. Administrador Principal (admin@drinklovers.com.ar)"
echo "2. Javier Rizzo (jsrxar@gmail.com)"
echo "======================================================"
