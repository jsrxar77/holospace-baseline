#!/usr/bin/env bash
# ============================================================================
# bin/backup-database.sh - Script de Respaldo Automatizado de PostgreSQL 16
# ============================================================================

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "======================================================"
echo "🛡️ HoloSpace Backup Engine: Iniciando Respaldo PostgreSQL 16"
echo "======================================================"

# 1. Respaldo PostgreSQL (Docker o host)
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "holospace_postgres"; then
  PG_BACKUP="${BACKUP_DIR}/holospace_pg_${TIMESTAMP}.sql.gz"
  echo "🐘 Generando dump comprimido de PostgreSQL en: $PG_BACKUP..."
  docker exec holospace_postgres pg_dump -U holospace_admin holospace_saas | gzip > "$PG_BACKUP"
  echo "✅ PostgreSQL backup completado: $(ls -lh "$PG_BACKUP" | awk '{print $5}')"
else
  echo "⚠️ Contenedor holospace_postgres no detectado."
fi

echo "======================================================"
echo "🎉 Proceso de Respaldo PostgreSQL finalizado con éxito."
echo "======================================================"
