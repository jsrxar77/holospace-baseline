#!/usr/bin/env bash
# ==============================================================================
# HOLOSPACE - CONFIRMACION, SUBIDA Y VERIFICACION DE DESPLIEGUE (GIT -> PROD)
# ==============================================================================

REMOTE_IP="5.161.237.189"
LOG_FILE="/opt/holospace/logs/deploy.log"
TIMEOUT=180
INTERVAL=10

echo "======================================================================"
echo "🚀 INICIANDO PROCESO DE PUBLICACION Y VERIFICACION DE DESPLIEGUE"
echo "======================================================================"

echo ""
echo "🔍 Analizando el estado de Git..."
git status --short

HAS_CHANGES=false
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain)" ]; then
    HAS_CHANGES=true
fi

UNPUSHED_COMMITS=$(git log origin/main..HEAD --oneline 2>/dev/null)

if [ "$HAS_CHANGES" = false ] && [ -z "$UNPUSHED_COMMITS" ]; then
    echo "✔️ No hay cambios pendientes ni commits por subir. Tu copia local esta al dia."
    exit 0
fi

if [ "$HAS_CHANGES" = true ]; then
    echo ""
    echo "📦 Se detectaron cambios locales."
    COMMIT_MSG=$1
    if [ -z "$COMMIT_MSG" ]; then
        read -p "✍️ Introduce el mensaje del commit: " COMMIT_MSG
    fi
    
    if [ -z "$COMMIT_MSG" ]; then
        echo "❌ Error: El mensaje del commit no puede estar vacio."
        exit 1
    fi
    
    echo "➕ Agregando cambios a Git..."
    git add -A
    git commit -m "$COMMIT_MSG"
    if [ $? -ne 0 ]; then
        echo "❌ Error al realizar el commit local."
        exit 1
    fi
fi

CURRENT_HASH=$(git rev-parse HEAD)
echo "🔑 Hash del commit a desplegar: $CURRENT_HASH"

echo ""
echo "⬆️ Subiendo cambios a GitHub (origin/main)..."
git push origin main
if [ $? -ne 0 ]; then
    echo "❌ Error al subir cambios a GitHub."
    exit 1
fi

echo "✔️ Cambios subidos a GitHub exitosamente."

echo ""
echo "======================================================================"
echo "⏳ ESPERANDO APLICACION EN SERVIDOR REMOTO ($REMOTE_IP)..."
echo "======================================================================"

# Ejecutar deploy de inmediato en el remoto
ssh "root@$REMOTE_IP" "bash /opt/holospace/bin/helper/deploy.sh"

echo ""
echo "======================================================================"
echo "🎉 DESPLIEGUE EN PRODUCCION VERIFICADO Y COMPLETADO EXITOSAMENTE"
echo "======================================================================"
