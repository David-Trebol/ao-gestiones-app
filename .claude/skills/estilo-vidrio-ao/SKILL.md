---
name: estilo-vidrio-ao
description: Estilo visual «vidrio cálido» de AO Gestiones (inspirado en un «Glassy dashboard»). Úsala al crear o retocar cualquier pantalla de la app para que mantenga el mismo aspecto: fondo cálido difuminado, paneles de vidrio esmerilado, una única tarjeta naranja protagonista y datos ordenados como el Excel de pedidos.
---

# Estilo «vidrio cálido» de AO Gestiones

## Piezas de código (no inventar otras)
- `colors.ambient` (constants/colors.ts): fondo difuminado, con naranja de marca arriba a la derecha, melocotón a la izquierda y azul acero abajo. Lo pintan `sceneBackground()` y `body::before`. Las escenas siempre opacas (ver docs/riesgos.md).
- `panel(colors, isDark)` (constants/theme.ts): tarjeta de vidrio esmerilado (translúcida, blur 22, borde claro, brillo interior y sombra amplia). Para contenedores: tarjetas, tablas y cifras. **Nunca en cada fila de una lista**, porque el desenfoque cuesta en móviles.
- `heroFill(colors)`: degradado naranja de marca. **Una sola por pantalla**: es lo protagonista (en la ficha, la cabecera del pedido). El texto encima va en `colors.onPrimary` (navy). El botón principal encima es navy con texto blanco, y las píldoras son blancas translúcidas (navy en oscuro).
- `liquidGlass()`: solo para barras y controles flotantes (barra de pestañas y título compacto).
- Barra lateral: panel navy translúcido flotante, separado 10 px del borde y con radio 22.

## Formas
- Radios: 26 en la tarjeta protagonista, 20–22 en paneles y 18 en las cifras; píldoras 999.
- Cifras clave: fila de 4 paneles (icono en círculo naranja suave, etiqueta, valor de 24/800 y una línea de apoyo). En móvil, 2×2.
- Tipografía Figtree: cliente 32/800 (es lo que se busca primero), referencia en `colors.reference`, totales en tabular-nums 800.

## Orden de la información (como el Excel)
1. Cliente (empresa, contacto, dirección y CP-población, teléfono y email).
2. Referencia, fecha y fabricante·año.
3. Productos: «N productos · M uds» y «2× Nombre» de los primeros (`itemsSummary`).
4. Total con IVA y estado.

La lista de ordenador sigue ese orden de izquierda a derecha (`OrderTable`), y la tarjeta de móvil de arriba abajo (`OrderCardItem`).

## Comprobar siempre
- `node e2e/t13-solapes-elementos.js` (también con `BIG=1`) y `node e2e/t11-solapes.js`.
- Capturas en claro y oscuro a 390 y 1440. En oscuro, revisar el contraste de lo que va encima del naranja.
