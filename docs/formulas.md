# Fórmulas (utils/calculations.ts) — no cambiar sin permiso

- Línea: si `total_sin_iva > 0` → `valor_sin_iva = total_sin_iva × (1 − dto/100)`; si no → `tpv_unitario × (1 − dto/100) × cantidad`. `beneficio_bruto = valor_sin_iva − costo_unitario × cantidad`. `valor_con_iva = valor_sin_iva × (1 + IVA/100)`.
- Gasto de envío: `total_sin_iva` si > 0, si no `costo_unitario × cantidad`; con su IVA.
- Pedido: `total_ex_vat` y `total_vat` = solo productos; `total_with_vat = productos + IVA + gastos de envío con IVA + shipping_cost` («Envío extra», importe fijo sin IVA).
- Moneda: `Intl.NumberFormat('es-ES', EUR)` (4 cifras sin punto de miles: «2670,47 €»; cambiarlo está pendiente de decisión).
