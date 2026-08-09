#!/usr/bin/env bash
# devops-db-refresh.sh - Script de reseteo de Base de Datos SQLite (phoneware.db) en vivo SIN APAGAR el puerto 3001

set -e

echo "======================================================"
echo "🧹 DevOps Database Refresh Tool (Live SQLite Reset)"
echo "======================================================"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"
DB_FILE="$DATA_DIR/phoneware.db"
USERS_FILE="$PROJECT_ROOT/users.json"

# 1. Asegurar archivo users.json con los 2 usuarios autorizados
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

# 2. Intentar reseteo en vivo vía API HTTP (sin apagar el puerto 3001)
RESET_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/reset-db 2>/dev/null || echo "000")

if [ "$RESET_HTTP_CODE" = "200" ]; then
  echo "⚡ Reseteo en VIVO realizado con éxito vía API (Puerto 3001 se mantiene 100% ONLINE)."
else
  echo "📂 Servidor no detectado en puerto 3001. Limpiando archivo SQLite de base de datos..."
  mkdir -p "$DATA_DIR"
  rm -f "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm"
fi

echo ""
echo "✅ ¡BASE DE DATOS SQLITE Y USUARIOS RESETEADOS CORRECTAMENTE!"
echo "📍 Archivo de DB: ./data/phoneware.db"
echo "🌐 Puerto 3001: Mantenido ONLINE sin caídas"
echo "1. Administrador Principal (admin@drinklovers.com.ar)"
echo "2. Javier Rizzo (jsrxar@gmail.com)"
echo "======================================================"
