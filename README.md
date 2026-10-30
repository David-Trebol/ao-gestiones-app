# AO Gestiones — Libro de pedidos

App de gestión de pedidos por **año → fabricante → pedido**, con clientes, productos, portes, IVA, descuentos, búsqueda y usuarios.

| Parte | Tecnología |
|---|---|
| App (web, iOS, Android) | Expo / React Native — carpeta [`expo/`](expo) |
| Base de datos, login y funciones | Supabase (proyecto `AO Gestiones`, región París) |
| Web publicada | Vercel (despliega solo con cada `git push` a `main`) |
| App iOS nativa (prototipo Rork, sin conectar a Supabase) | Swift — carpeta [`ios-floworders/`](ios-floworders) |

## Arrancar en local

```bash
cd expo
bun install        # o: npm install  (.npmrc ya incluye legacy-peer-deps)
npx expo start     # w = navegador · escanea el QR con Expo Go para el móvil
```

## Comandos útiles

```bash
bun run typecheck   # TypeScript
bun run lint        # ESLint
bun run build:web   # genera la web en expo/dist
```

## Supabase

- Tablas: `orders`, `manufacturers`, `years`, `profiles` (RLS: solo usuarios **activos** con sesión).
- Funciones (Edge Functions):
  - `admin-users` — crear / editar / desactivar / borrar usuarios (solo admins).
  - `extract-order` — desactivada (antes usaba IA). La lectura de documentos ya no usa ningún servicio externo.
  - `setup-admin` — alta de la primera cuenta de administrador (se desactiva sola cuando ya existe un admin).
- La URL y la clave publicable están en `expo/lib/supabase.ts` (se pueden sobrescribir con `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY`). La clave publicable es pública por diseño; la seguridad la dan las políticas RLS.

## Origen

Código exportado de Rork y migrado a Supabase (sin dependencias de Rork).

## Lectura de documentos (sin IA ni servicios externos)

En el formulario de pedido, «Leer datos de un documento» lee PDF, JPG, PNG o WEBP **dentro del navegador**:

- **PDF con texto**: se extrae el texto exacto con PDF.js.
- **Fotos y PDF escaneados**: OCR con Tesseract (WebAssembly), con corrección de inclinación y de giros de 90°/180°.
- Las librerías y el idioma español están en `expo/public/vendor` y se sirven desde la propia web: el archivo no sale del dispositivo y no hay claves ni APIs.
- Unas reglas (`expo/utils/docread/parse.ts`) separan emisor y cliente, validan NIF/CIF/NIE (letra de control), deducen la provincia por el código postal, leen referencias, condiciones, líneas y totales, y comprueban que cantidad × precio − dto = importe y que la suma cuadre con la base imponible.
- Antes de tocar el formulario se abre una pantalla de revisión: documento y datos lado a lado (en móvil, con pestañas), campos dudosos marcados, origen de cada dato, y nada se sustituye sin marcarlo.
- Límites: 25 MB, 30 páginas por PDF, 8 páginas escaneadas con OCR. En la app nativa (iOS/Android) la lectura no está disponible: se usa la versión web.
