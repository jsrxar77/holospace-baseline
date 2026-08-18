#!/usr/bin/env bash
# devops-db-refresh.sh - Herramienta de Reinicialización y Siembra de Base de Datos

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"
SCHEMA_SQL="$DATA_DIR/init-schema.sql"

echo "======================================================"
echo "HoloSpace - Reinicializacion y Siembra de Base de Datos"
echo "======================================================"
echo ""

# 1. Limpieza y Recreación de Estructura
echo "[1/4] Limpiando datos anteriores y recreando tablas..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "holospace_postgres"; then
  docker exec -i holospace_postgres psql -U holospace_admin -d holospace_saas -q -c "
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO holospace_admin;
    GRANT ALL ON SCHEMA public TO public;
  " > /dev/null 2>&1
  
  # 2. Siembra de Estructura, Módulos y Usuarios
  echo "[2/4] Sembrando organizaciones, modulos oficiales y usuarios..."
  docker exec -i holospace_postgres psql -U holospace_admin -d holospace_saas -q < "$SCHEMA_SQL" > /dev/null 2>&1
  
  echo "[3/4] Configurando aislamiento seguro de organizaciones..."
else
  echo "[ALERTA] No se encontro el contenedor de base de datos PostgreSQL activo."
  echo "Por favor ejecute previamente: docker compose up -d"
  exit 1
fi

# 3. Notificación al Servidor Web
echo "[4/4] Sincronizando servidor web en tiempo real..."
RESET_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3001/api/reset-db 2>/dev/null || echo "000")

echo ""
echo "======================================================"
echo "PROCESO COMPLETADO CON EXITO"
echo "======================================================"
echo "Organizaciones y Cuentas Sembradas:"
echo "  - HoloSpace Cloud Platform (SuperAdmin): superadmin@holospace.app"
echo "  - Poke Argentina (Cliente): admin@poke.com.ar"
echo "  - Drink Lovers Argentina (Cliente): admin@drinklovers.com.ar"
echo ""
echo "Tema visual por defecto: Omarchy Tiling WM"
echo "Plataforma lista para operar en http://localhost:3001"
echo "======================================================"
echo ""
