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
  - `extract-order` — lee pedidos en PDF o imagen con IA (necesita el secreto `ANTHROPIC_API_KEY`).
  - `setup-admin` — alta de la primera cuenta de administrador (se desactiva sola cuando ya existe un admin).
- La URL y la clave publicable están en `expo/lib/supabase.ts` (se pueden sobrescribir con `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY`). La clave publicable es pública por diseño; la seguridad la dan las políticas RLS.

## Origen

Código exportado de Rork y migrado a Supabase (sin dependencias de Rork).
