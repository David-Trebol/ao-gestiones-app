# Pila y estructura

- Expo SDK 54 + React Native 0.81 + expo-router 6 + react-native-web (la app se usa como **web**; nativo existe pero no es prioritario). Gestor: **bun** (`bun.lock`). TypeScript estricto.
- Supabase (Auth email+contraseña, Postgres con RLS, Realtime) a través de `@supabase/supabase-js`. Clave publicable en `expo/lib/supabase.ts` (es pública).
- React Query para la caché; contextos con `@nkzw/create-context-hook`.

```
expo/
  app/                     rutas (expo-router)
    _layout.tsx            proveedores, puerta de acceso (login / recuperar contraseña)
    login.tsx              pantalla de entrada (también alta del primer administrador)
    (tabs)/_layout.tsx     navegación principal (ver docs/PLAN.md, fase 1)
    (tabs)/(home)/         Pedidos: index (resumen + lista o carpetas año→fabricante), order-detail, order-form*
    (tabs)/manufacturers/  Fabricantes
    (tabs)/settings/       Ajustes: perfil, tema, resumen, usuarios (admin), cambiar contraseña, borrar todo
  components/              StatusBadge, SelectSheet, DocumentReview, DateField, WebAlertHost (Alert en web), home/OrdersDashboard…
  contexts/                AuthContext (sesión, perfil, usuarios), DataContext (todas las lecturas y escrituras), ThemeContext
  constants/               colors.ts (paleta claro/oscuro), theme.ts (tipos, radios, sombras), animation.ts, navigation.ts
  utils/
    calculations.ts        FÓRMULAS (no tocar sin permiso) y formato de moneda/fechas
    orderFilters.ts        filtros, orden, reglas de «requieren atención» y retrasos
    docread/               lectura local de documentos (ver abajo)
    exportExcel.ts         exportar a .xlsx (rama fase-1-estructura)
  public/vendor/           pdf.js y tesseract (núcleo, worker e idioma «spa») servidos por la propia web
tools/                     pruebas (ver «Pruebas»)
docs/PLAN.md               plan por fases, estado y decisiones pendientes
```

*En `main` el detalle y el formulario siguen en `expo/app/order-detail.tsx` y `expo/app/order-form.tsx`; en la rama `fase-1-estructura` se movieron dentro de `(tabs)/(home)/` para que la barra lateral no desaparezca al abrir un pedido. Las URL no cambian (`/order-detail?orderId=…`, `/order-form?editOrderId=…`).

Vercel: raíz `expo`, `bun install`, `npx expo export --platform web`, salida `dist`, reescrituras SPA en `expo/vercel.json`. Cada push a `main` despliega a producción; comprobar el estado del despliegue y abrir la web.

Desarrollo: `cd expo && bun install && npx expo start --web`.
