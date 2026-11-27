#!/bin/bash
# Prepara la web para subirla a Hostinger: compila, añade los .htaccess y crea el zip.
# Uso: bash tools/hostinger/preparar.sh   →  tools/out/hostinger/ao-gestiones-web.zip
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
SALIDA="$RAIZ/tools/out/hostinger"
WEB="$SALIDA/public_html"
rm -rf "$SALIDA" && mkdir -p "$SALIDA"
cd "$RAIZ/expo"
npx expo export --platform web --output-dir "$WEB" > "$SALIDA/compilacion.log" 2>&1 || { tail -20 "$SALIDA/compilacion.log"; exit 1; }
python3 "$RAIZ/tools/hostinger/htaccess.py" "$WEB"
find "$WEB" -name .DS_Store -delete
cd "$WEB" && zip -qr -X "$SALIDA/ao-gestiones-web.zip" . && cd - > /dev/null
echo "Listo: $SALIDA/ao-gestiones-web.zip ($(du -h "$SALIDA/ao-gestiones-web.zip" | cut -f1))"
