#!/usr/bin/env bash
# devops-git-push-verify.sh - Script de automatización para commit, push y verificación de sincronización Git

set -e

COMMIT_MSG="${1:-"feat: updates and fixes $(date '+%Y-%m-%d %H:%M:%S')"}"

echo "======================================================"
echo "🚀 DevOps Git Push & Verification Tool"
echo "======================================================"

echo "📦 1. Agregando archivos al área de preparación (git add .)..."
git add .

if git diff-index --quiet HEAD --; then
  echo "ℹ️ No hay cambios nuevos para commitear."
else
  echo "✍️ 2. Creando commit: '$COMMIT_MSG'..."
  git commit -m "$COMMIT_MSG"
fi

echo "⬆️ 3. Enviando cambios al repositorio remoto (git push origin main)..."
git push origin main

echo "🔍 4. Verificando estado de sincronización con origin/main..."
git fetch origin main

STATUS_OUTPUT=$(git status)
echo "$STATUS_OUTPUT"

if echo "$STATUS_OUTPUT" | grep -q "working tree clean" && echo "$STATUS_OUTPUT" | grep -q "up to date"; then
  echo ""
  echo "✅ ¡VERIFICACIÓN EXITOSA! El repositorio local y remoto están 100% sincronizados y limpios."
else
  echo ""
  echo "⚠️ Advertencia: Hay diferencias o archivos pendientes."
fi
echo "======================================================"
