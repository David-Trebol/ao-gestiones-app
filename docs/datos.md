# Datos (Supabase)

Tablas en `public`, todas con RLS que exige `private.is_active_user()`; las de administración usan `private.is_admin()`:

- `years(year pk)`
- `manufacturers(id text pk, name, code unique en mayúsculas, active_years int[])` — en la interfaz se llaman **«Referencias de pedido»** (ESP, ONS…: el código va al principio de la referencia). Los nombres internos (`manufacturer_*`, ruta `/manufacturers`) no cambian.
- `suppliers(id text pk, name, contact, phone, email, notes, created_at)` — **Fabricantes** reales (a quién se le compra cada producto). Pantalla `/suppliers`. RLS igual que `manufacturers`. Creada el 25/11/2026 (migración `create_suppliers`, solo añade).
- `orders(id text pk, reference_number unique, custom_reference, manufacturer_id fk, manufacturer_name, manufacturer_code, year, status, customer jsonb, items jsonb, shipping_items jsonb, shipping_cost, total_ex_vat, total_vat, total_with_vat, expected_date date null, owner text, next_action text, created_at, updated_at)`
  - Cada elemento de `items` puede llevar `item_status` opcional: `pending` (amarillo, como «Procesando»), `shipped` (azul cielo, como «Enviado») o `delivered` (verde, como «Entregado»); sin valor = sin empezar. Se cambia desde la ficha (`updateItemStatus`, de uno en uno o todos a la vez) sin tocar importes ni el estado del pedido; la copia de un pedido empieza sin estados.
  - Además, opcionales: `supplier_id` + `supplier_name` (fabricante del producto; el nombre se copia para que se siga viendo si se borra el fabricante) y `supplier_log` = lista de apuntes `{id, type: 'ordered'|'received'|'payment_pending'|'paid'|'other', date AAAA-MM-DD, note?, created_at}` (registro con el fabricante: pedido, recibido, pendiente de pago, pagado, otro). Un producto con «pendiente de pago» sin un «pagado» igual o posterior cuenta como incidencia por resolver (inicio, filtro «Incidencias por resolver»). Se cambian desde la ficha (`updateItemSupplier`); el formulario los conserva; la copia de un pedido mantiene el fabricante pero no el registro.
- `profiles(id → auth.users, email, display_name, role 'admin'|'user', active)`; el disparador de alta siempre crea `role='user'`, `active=false`.
- Funciones Edge: `admin-users` (crear/editar/borrar usuarios; solo admin activo), `setup-admin` (alta del primer admin; ya usada, responde 409), `extract-order` (**desactivada**, devuelve 410).
- RPC `public.keepalive()` (devuelve `now()`, ejecutable por `anon`): pensada para una llamada periódica que evite la pausa del plan gratis. **Aún no hay nada que la llame** (ver riesgos).

Estados: `pending` Pendiente, `processing` Procesando, `shipped` Enviado, `delivered` Entregado, `cancelled` Cancelado. Mostrar siempre el nombre completo. Qué significa «Enviado» (¿por el fabricante o al cliente?) está **pendiente de confirmar** por el propietario.

Referencia de pedido: `CÓDIGO-AÑO-NNN` (el propietario quiere pasar a `CÓDIGO-número seguido`, p. ej. ESP-1081, y que la proforma decida la referencia: **pendiente, más adelante**) con el número más alto existente + 1 (`generateReferenceNumber`). Si cambia fabricante o año al editar, se renumera.

Referencia propia (`custom_reference`, «Referencia» en la interfaz): la de la empresa, `CÓDIGO-número` sin año (ESP-620). Se escribe solo el número detrás del código fijo; si solo hay número se guarda como `CÓDIGO-n`, el texto libre se guarda tal cual. El formulario y la ficha proponen «Continuar con CÓDIGO-(más alta + 1)» mirando todas las referencias propias de ese código, de cualquier año (`utils/references.ts`). Se muestra como «ESP-620 (2026)»; si no hay, se ve la automática. La automática `reference_number` no cambia.
