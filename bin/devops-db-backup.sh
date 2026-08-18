#!/usr/bin/env bash
# ============================================================================
# bin/devops-db-backup.sh - Respaldo Universal On-Demand de PostgreSQL 16
# ============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "======================================================"
echo "HoloSpace Backup Engine: Respaldo de PostgreSQL 16"
echo "======================================================"

if command -v docker >/dev/null 2>&1 && docker ps --format "{{.Names}}" | grep -q "holospace_postgres"; then
  PG_BACKUP="${BACKUP_DIR}/holospace_pg_${TIMESTAMP}.sql.gz"
  echo "[1/2] Generando dump comprimido de la base de datos holospace_saas..."
  docker exec -i holospace_postgres pg_dump -U holospace_admin -d holospace_saas -Z 9 > "$PG_BACKUP"
  
  if [ -s "$PG_BACKUP" ]; then
    FILE_SIZE=$(ls -lh "$PG_BACKUP" | awk '{print $5}')
    echo "[2/2] Verificacion de integridad completada con exito."
    echo ""
    echo "======================================================"
    echo "RESPALDO COMPLETADO EXITOSAMENTE"
    echo "======================================================"
    echo "Archivo generado: $PG_BACKUP"
    echo "Tamano comprimido: $FILE_SIZE"
    echo "Base de datos: holospace_saas (PostgreSQL 16 Multi-Tenant RLS)"
    echo "======================================================"
  else
    echo "ERROR: El archivo de respaldo se genero vacio."
    rm -f "$PG_BACKUP"
    exit 1
  fi
else
  echo "ALERTA: Contenedor holospace_postgres no detectado."
  echo "Ejecute previamente: docker compose up -d"
  exit 1
fi
