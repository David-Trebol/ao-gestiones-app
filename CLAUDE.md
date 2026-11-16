# AO Gestiones · Libro de pedidos

Herramienta interna para gestionar los pedidos de la empresa: pedidos (con los datos del cliente dentro), fabricantes, años, usuarios y seguimiento. Sustituye a una hoja de Excel (un bloque por pedido con Empresa, Contacto, Dpto., Su pedido-Nº Ref, Dir. 1/2, CP-Población, Provincia/País, Telf. 1/2, Email, NIF, Oferta/Proforma, Cond. Entrega, Cond. Pago, FRA/Vcto. Recibo).

- **Web publicada:** https://ao-gestiones-pedidos.vercel.app (Vercel publica sola cada `git push` a `main`).
- **Repositorio:** github.com/David-Trebol/ao-gestiones-app (público: no subas nada privado).
- **Base de datos:** Supabase, proyecto «AO Gestiones», id `ixsosbtieclihoizmszq`, región París, plan gratis.
- **Plan de mejoras y estado:** `docs/PLAN.md` (léelo antes de empezar cualquier tarea).

## Reglas del propietario (obligatorias)

1. **Todo en español**: interfaz, mensajes de error, commits y explicaciones.
2. **Después de cada cambio, publícalo y compruébalo en la URL de Vercel** antes de decir que está hecho. El propietario revisa siempre en la web publicada.
3. **Responsive de verdad**: cada cambio se comprueba en móvil (320, 390, 844×390 horizontal), tablet (768) y ordenador (1024, 1440, 1920). No basta con que «quepa»: orden, jerarquía y nada flotando ni tapando contenido.
4. **No cambiar la lógica de negocio sin permiso**: fórmulas de importes, significado de los estados, referencias y datos guardados. Las mejoras visuales se hacen; lo que cambia datos o forma de trabajar se propone y se espera respuesta.
5. **Sin migraciones destructivas** y sin pérdida de datos. Columnas nuevas siempre opcionales.
6. **La lectura de documentos no usa IA ni servicios externos** (decisión del propietario): PDF.js + OCR Tesseract en el navegador, con reglas propias. No añadir APIs de IA.
7. **No afirmar haber probado algo que no se ha probado.** Separar lo comprobado de lo que queda por comprobar.
8. **Nunca escribir ni elegir contraseñas del propietario** ni de otros usuarios.

## Pila y estructura

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

## Datos (Supabase)

Tablas en `public`, todas con RLS que exige `private.is_active_user()`; las de administración usan `private.is_admin()`:

- `years(year pk)`
- `manufacturers(id text pk, name, code unique en mayúsculas, active_years int[])`
- `orders(id text pk, reference_number unique, custom_reference, manufacturer_id fk, manufacturer_name, manufacturer_code, year, status, customer jsonb, items jsonb, shipping_items jsonb, shipping_cost, total_ex_vat, total_vat, total_with_vat, expected_date date null, owner text, next_action text, created_at, updated_at)`
- `profiles(id → auth.users, email, display_name, role 'admin'|'user', active)`; el disparador de alta siempre crea `role='user'`, `active=false`.
- Funciones Edge: `admin-users` (crear/editar/borrar usuarios; solo admin activo), `setup-admin` (alta del primer admin; ya usada, responde 409), `extract-order` (**desactivada**, devuelve 410).
- RPC `public.keepalive()` (devuelve `now()`, ejecutable por `anon`): pensada para una llamada periódica que evite la pausa del plan gratis. **Aún no hay nada que la llame** (ver riesgos).

Estados: `pending` Pendiente, `processing` Procesando, `shipped` Enviado, `delivered` Entregado, `cancelled` Cancelado. Mostrar siempre el nombre completo. Qué significa «Enviado» (¿por el fabricante o al cliente?) está **pendiente de confirmar** por el propietario.

Referencia de pedido: `CÓDIGO-AÑO-NNN` con el número más alto existente + 1 (`generateReferenceNumber`). Si cambia fabricante o año al editar, se renumera.

## Fórmulas (utils/calculations.ts) — no cambiar sin permiso

- Línea: si `total_sin_iva > 0` → `valor_sin_iva = total_sin_iva × (1 − dto/100)`; si no → `tpv_unitario × (1 − dto/100) × cantidad`. `beneficio_bruto = valor_sin_iva − costo_unitario × cantidad`. `valor_con_iva = valor_sin_iva × (1 + IVA/100)`.
- Gasto de envío: `total_sin_iva` si > 0, si no `costo_unitario × cantidad`; con su IVA.
- Pedido: `total_ex_vat` y `total_vat` = solo productos; `total_with_vat = productos + IVA + gastos de envío con IVA + shipping_cost` («Envío extra», importe fijo sin IVA).
- Moneda: `Intl.NumberFormat('es-ES', EUR)` (4 cifras sin punto de miles: «2670,47 €»; cambiarlo está pendiente de decisión).

## Lectura de documentos (utils/docread)

`read.web.ts` abre el archivo en el navegador: PDF con texto → PDF.js; imágenes y PDF escaneados → Tesseract con corrección de inclinación (`layout.deskew`) y prueba de giros 90/180/270. `parse.ts` reconoce con reglas emisor/cliente, NIF/CIF/NIE con letra de control, CP→provincia, referencias, líneas (cantidad × precio − dto = importe; separa números que el OCR junta solo si cuadran), totales e IVA. `review.ts` + `components/DocumentReview.tsx` = pantalla de revisión: nada se aplica al formulario sin marcarlo y nunca se sobrescribe un dato existente por defecto. En nativo (`read.ts`) solo informa de que está disponible en la web.

## Comandos

```bash
cd expo
bun install
npx tsc --noEmit            # tipos (debe salir limpio)
npx eslint app components utils
npx expo start --web        # desarrollo
npx expo export --platform web --output-dir ../tools/out/dist   # compilación como en Vercel
```

Vercel: raíz `expo`, `bun install`, `npx expo export --platform web`, salida `dist`, reescrituras SPA en `expo/vercel.json`. Cada push a `main` despliega a producción; comprobar el estado del despliegue y abrir la web.

## Pruebas (tools/)

Las pruebas e2e usan **Playwright con un Supabase simulado** (`tools/e2e/mock.js`): no tocan la base de datos real.

```bash
cd tools && npm install && npx playwright install chromium
./serve.sh out/dist 8780                     # servir la compilación (en Mac sin setsid: npx -y serve -s out/dist -l 8780)
PORT=8780 node e2e/t1.js                     # entrar / contraseña incorrecta
PORT=8780 node e2e/t2.js                     # crear, editar, decimales, renumerar, duplicar, borrar
PORT=8780 node e2e/t4.js                     # duplicar año, búsqueda, fabricantes, ajustes, salir
PORT=8780 node e2e/t9-home.js                # inicio, filtros, detalle, estado, autocompletar, seguimiento
PORT=8780 node e2e/t5-scan.js samples/01-factura-proveedor.pdf 390 prueba   # lectura de documentos
PORT=8780 node e2e/t7-errors.js              # errores de lectura y cancelar
node e2e/shots.js <prefijo> 8780 [normal|big] home,detail,form,manufacturers,settings   # capturas en 6 tamaños + comprobación de desbordes
cd unit && bun run calc.test.ts              # fórmulas
cd docread && bun run check.ts               # lector con los 7 documentos de muestra (necesita pdfjs-dist 3.11 y tesseract con «spa»)
```

`seed.js` = 5 pedidos de ejemplo; `seedbig.js` = 300 pedidos con nombres largos, importes grandes y 40 líneas. Capturas y resultados en `tools/out/` (ignorado por git). Las pruebas de `tools/e2e` están ajustadas a la interfaz de la rama `fase-1-estructura`.

## Riesgos conocidos

- **El plan gratis de Supabase pausa la base de datos tras 7 días sin uso** (pasó el 13/11/2026; se reactivó pausando el proyecto «TaskFlow»). Opciones pendientes de decisión del propietario: plan Pro, o una tarea programada que llame a `keepalive()` (por ejemplo, un workflow de GitHub Actions cada 3 días; crearlo requiere su aprobación).
- No hay copia de seguridad descargable salvo la exportación a Excel (rama fase-1).
- «Eliminar todos los datos» (Ajustes, solo admin) borra todo con una confirmación: endurecerlo es parte de la fase 0.
- Sin comprobar: a qué dirección devuelve el correo de «He olvidado mi contraseña» (Site URL de Supabase Auth) y la protección de contraseñas filtradas.
- La app descarga todos los pedidos al entrar: bien hasta unos miles; más allá habrá que paginar.
