#!/usr/bin/env bash
# ==============================================================================
# HOLOSPACE - SCRIPT DE AUTO-DESPLIEGUE EN SERVIDOR REMOTO
# ==============================================================================

PROJECT_DIR="/opt/holospace"
BRANCH="main"
LOG_FILE="$PROJECT_DIR/logs/deploy.log"

mkdir -p "$PROJECT_DIR/logs"
cd "$PROJECT_DIR" || exit 1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔍 Buscando cambios en holospace-baseline..." >> "$LOG_FILE"

git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 Actualizacion detectada. Sincronizando..." >> "$LOG_FILE"
    git reset --hard "origin/$BRANCH" >> "$LOG_FILE" 2>&1
    chmod +x bin/*.sh bin/helper/*.sh 2>/dev/null || true

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🐋 Reconstruyendo y levantando contenedores HoloSpace..." >> "$LOG_FILE"
    docker compose up -d --build >> "$LOG_FILE" 2>&1

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Despliegue completado: $REMOTE_HASH" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✔️ Sin cambios." >> "$LOG_FILE"
fi
