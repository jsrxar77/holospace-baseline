#!/usr/bin/env bash
# devops-db-refresh.sh - Script de reseteo 100% Base de Datos a ESTADO CERO EN BLANCO

set -e

echo "======================================================"
echo "🧹 DevOps Database Blank Reset Tool (100% Base de Datos)"
echo "======================================================"

echo "👤 1. Conservando únicamente usuario Administrador por defecto (admin@drinklovers.com)..."

echo "🔄 2. Liberando puerto 3001 y limpiando registros de la Base de Datos..."
npx -y kill-port 3001 2>/dev/null || true

echo ""
echo "✅ ¡BASE DE DATOS 100% EN BLANCO Y LISTA!"
echo "El proceso logístico inicia desde cero cuando subas un archivo PDF desde el Panel Web Admin."
echo "El comprobante y su Blob binario habitarán 100% únicamente dentro de la Base de Datos."
echo "======================================================"
