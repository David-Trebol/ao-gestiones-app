# Datos (Supabase)

Tablas en `public`, todas con RLS que exige `private.is_active_user()`; las de administración usan `private.is_admin()`:

- `years(year pk)`
- `manufacturers(id text pk, name, code unique en mayúsculas, active_years int[])`
- `orders(id text pk, reference_number unique, custom_reference, manufacturer_id fk, manufacturer_name, manufacturer_code, year, status, customer jsonb, items jsonb, shipping_items jsonb, shipping_cost, total_ex_vat, total_vat, total_with_vat, expected_date date null, owner text, next_action text, created_at, updated_at)`
- `profiles(id → auth.users, email, display_name, role 'admin'|'user', active)`; el disparador de alta siempre crea `role='user'`, `active=false`.
- Funciones Edge: `admin-users` (crear/editar/borrar usuarios; solo admin activo), `setup-admin` (alta del primer admin; ya usada, responde 409), `extract-order` (**desactivada**, devuelve 410).
- RPC `public.keepalive()` (devuelve `now()`, ejecutable por `anon`): pensada para una llamada periódica que evite la pausa del plan gratis. **Aún no hay nada que la llame** (ver riesgos).

Estados: `pending` Pendiente, `processing` Procesando, `shipped` Enviado, `delivered` Entregado, `cancelled` Cancelado. Mostrar siempre el nombre completo. Qué significa «Enviado» (¿por el fabricante o al cliente?) está **pendiente de confirmar** por el propietario.

Referencia de pedido: `CÓDIGO-AÑO-NNN` con el número más alto existente + 1 (`generateReferenceNumber`). Si cambia fabricante o año al editar, se renumera.
