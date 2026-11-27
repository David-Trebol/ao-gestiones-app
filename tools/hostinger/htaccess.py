"""Genera los .htaccess de Hostinger (Apache/LiteSpeed) a partir de expo/vercel.json,
para que las cabeceras de seguridad sean siempre las mismas en Vercel y en Hostinger.
Uso: python3 htaccess.py <carpeta_web>"""
import json, pathlib, sys

raiz = pathlib.Path(__file__).resolve().parents[2]
web = pathlib.Path(sys.argv[1])
vercel = json.loads((raiz / 'expo' / 'vercel.json').read_text())
comunes = next(h for h in vercel['headers'] if h['source'] == '/(.*)')['headers']
cabeceras = '\n'.join(f'  Header always set {h["key"]} "{h["value"]}"' for h in comunes)

(web / '.htaccess').write_text(f'''# AO Gestiones — generado por tools/hostinger/htaccess.py (no editar a mano)
Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /index.html

AddType application/wasm .wasm
AddType text/javascript .js .mjs
AddType application/manifest+json .webmanifest

<IfModule mod_rewrite.c>
  RewriteEngine On
  # Siempre por https
  RewriteCond %{{HTTPS}} !=on
  RewriteCond %{{HTTP:X-Forwarded-Proto}} !https
  RewriteRule ^ https://%{{HTTP_HOST}}%{{REQUEST_URI}} [L,R=301]
  # La app es de una sola página: cualquier ruta que no sea un archivo abre index.html
  RewriteCond %{{REQUEST_FILENAME}} !-f
  RewriteCond %{{REQUEST_FILENAME}} !-d
  RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_headers.c>
{cabeceras}
  Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
  # index.html siempre fresco para que se vea la última versión al publicar
  <FilesMatch "\\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json application/manifest+json application/wasm image/svg+xml
</IfModule>
''')

(web / '_expo' / 'static' / '.htaccess').write_text('''# Archivos con huella en el nombre: no cambian nunca
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
''')

(web / 'vendor' / '.htaccess').write_text('''# Lector de documentos (pdf.js y OCR)
# El .gz del idioma del OCR se entrega tal cual: el navegador no debe descomprimirlo
RemoveEncoding .gz
AddType application/gzip .gz
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=604800"
</IfModule>
''')
print('htaccess OK')
