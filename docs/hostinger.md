# Publicar en Hostinger

La web también puede vivir en Hostinger, a la vez que en Vercel. Las dos usan la **misma base de datos** (Supabase): lo que se guarde en una se ve en la otra.

## Qué se sube y qué no

- **Se sube**: la web ya compilada (archivos estáticos). Vale cualquier plan de alojamiento web de Hostinger (Premium, Business…); no hace falta VPS ni Node.js.
- **No se sube la base de datos.** Sigue en Supabase. El MySQL de Hostinger no tiene cuentas de usuario, permisos por fila ni funciones de administración: pasarlo ahí obligaría a rehacer la app. Supabase acepta la web desde cualquier dominio (comprobado: las funciones responden a cualquier origen y la seguridad depende de la sesión, no del dominio).

## Preparar el paquete

```bash
bash tools/hostinger/preparar.sh
```

Crea `tools/out/hostinger/ao-gestiones-web.zip` (no va al repositorio). Lleva la web y tres `.htaccess` que `tools/hostinger/htaccess.py` genera desde `expo/vercel.json`, así las cabeceras de seguridad son las mismas que en Vercel:

- todas las rutas (`/order-form`, `/settings`…) abren la app; http pasa a https;
- cabeceras de seguridad (CSP, marcos, HSTS…);
- caché: `index.html` siempre fresco, el código con huella un año, el lector de documentos una semana.

Probado con un Apache local (Hostinger usa LiteSpeed, compatible con `.htaccess`): rutas, cabeceras, entrar, inicio, leer PDF y foto con OCR y permisos.

## Subir (primera vez)

1. hPanel → **Sitios web** → el dominio → **Administrador de archivos** → carpeta `public_html`.
2. Borrar lo que traiga de ejemplo (`default.php`, `index.php`…).
3. **Subir** el zip y, con clic derecho, **Extraer** dentro de `public_html` (los archivos deben quedar directamente en `public_html`, no en una subcarpeta).
4. Activar los archivos ocultos para comprobar que están los `.htaccess`.
5. hPanel → **Seguridad → SSL**: instalar el certificado gratis y activar «Forzar HTTPS».
6. Supabase → Authentication → **URL Configuration** → Redirect URLs: añadir `https://<dominio>` (sin quitar el de Vercel). Sin esto, el enlace de «He olvidado mi contraseña» enviado desde Hostinger volvería a Vercel.
7. Probar en `https://<dominio>`: entrar, abrir un pedido, leer un documento.

## Actualizar

Vercel se actualiza solo con cada cambio. Hostinger no: tras un cambio, volver a ejecutar `preparar.sh`, borrar el contenido de `public_html` y repetir los pasos 3–4.

## Si algo cambia

- Si se añade un servicio externo, va en la CSP de `expo/vercel.json`; el `.htaccess` se regenera solo.
- La alerta de la app nativa (`order-form.tsx`) remite a la dirección de Vercel; sigue siendo válida.
