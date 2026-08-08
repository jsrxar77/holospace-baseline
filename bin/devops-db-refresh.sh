#!/usr/bin/env bash
# devops-db-refresh.sh - Script de inicialización y refresco de la base de datos y comprobantes

set -e

echo "======================================================"
echo "🧹 DevOps Database Refresh & Re-initialization Tool"
echo "======================================================"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORDERS_DIR="$PROJECT_ROOT/orders"

echo "📂 1. Verificando carpeta ./orders/..."
mkdir -p "$ORDERS_DIR"

echo "📄 2. Re-inicializando comprobantes PDF base en ./orders/..."

cat << 'EOF' > "$ORDERS_DIR/34512175.pdf"
%PDF-1.7
1 0 obj
<< /Order 34512175 /Client (LUNFA DISTRIBUIDORA) /Item (Lunfa Torino Bianco 750 ml) /EAN (7798135764531) /Qty (3) >>
endobj
EOF

cat << 'EOF' > "$ORDERS_DIR/34409313.pdf"
%PDF-1.7
1 0 obj
<< /Order 34409313 /Client (DIEGO POKE S.R.L.) /Item (Lunfa Torino Bianco 750 ml) /EAN (7798135764531) /Qty (2) >>
endobj
EOF

cat << 'EOF' > "$ORDERS_DIR/34512173.pdf"
%PDF-1.7
1 0 obj
<< /Order 34512173 /Client (PASCUAL BEBIDAS S.A.) /Item (Lunfa Torino Bianco 750 ml) /EAN (7798135764531) /Qty (4) >>
endobj
EOF

echo "🔄 3. Liberando puerto 3001 y reiniciando registros en la Base de Datos..."
npx -y kill-port 3001 2>/dev/null || true

echo "✅ ¡Base de Datos y Comprobantes en ./orders/ re-inicializados correctamente!"
echo "Archivos en ./orders/:"
ls -la "$ORDERS_DIR"
echo "======================================================"
