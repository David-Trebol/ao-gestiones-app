# Plan de mejoras · estado al 16/11/2026

Auditoría completa con capturas: https://claude.ai/artifact/MmmE6qeFAjeX4QpSss1KRu

Diagnóstico: la app funciona y los datos son correctos, pero su estructura era la de una app de móvil estirada: en ordenador la navegación iba abajo, cada pantalla tenía un ancho distinto y había elementos repetidos o flotando. El plan arregla primero la estructura común y después cada pantalla. **Cada fase se publica en Vercel y el propietario la valida antes de pasar a la siguiente.**

## Dónde está cada cosa

- `main` = lo publicado. Desde el 16/11/2026 incluye la fase 1 completa (rama `fase-1-estructura` fusionada).
- Pruebas al cerrar la fase 1: `tsc` y `eslint` limpios; t1 OK, t2 18/18, t4 14/14, t9 34/34, t7 OK, t5 OK, fórmulas OK; capturas en 6 tamaños (normal y 300 pedidos) sin desbordes.

## Fase 0 · Que no se caiga ni se pierda nada

- [x] RPC `public.keepalive()` creada en Supabase (no lee ni escribe datos).
- [x] Llamada cada 3 días (aprobada por el propietario el 16/11/2026): workflow `.github/workflows/keepalive-supabase.yml` (06:17 UTC, también a mano desde Actions). Primera ejecución correcta el 16/11/2026 (HTTP 200), aunque GitHub tardó ~1 h en arrancarla.
- [x] Exportar a Excel: `expo/utils/exportExcel.ts` (hojas Pedidos, Líneas, Envíos, Fabricantes; importes con formato €). Botón «Excel» en la lista de Pedidos (exporta lo filtrado). *En la rama.*
- [x] Ajustes → «Descargar copia completa» (Excel con pedidos, líneas, envíos y fabricantes).
- [x] «Eliminar todos los datos»: ventana propia que ofrece descargar la copia antes y solo se activa al escribir `ELIMINAR`.
- [ ] Comprobar en el panel de Supabase (Auth → URL Configuration) que el Site URL es `https://ao-gestiones-pedidos.vercel.app` para el correo de recuperar contraseña. Activar la protección de contraseñas filtradas.
- [ ] Idioma: `document.documentElement.lang = 'es'` (la web se sirve con `lang="en"`); hacerlo en `components/WebGlobalStyles.tsx`.

## Fase 1 · Estructura común

Hecho en la rama:
- [x] `components/AppNav.tsx`: barra lateral con textos y «Nuevo pedido» (≥ 1.200 px), lateral solo con iconos (768–1.199 px), barra inferior en móvil (se oculta en el formulario). Sustituye a la barra de pestañas por defecto (`app/(tabs)/_layout.tsx`, `tabBarPosition` dinámico).
- [x] Ficha y formulario movidos a `app/(tabs)/(home)/` para que la navegación no desaparezca al abrir un pedido (`unstable_settings.initialRouteName = 'index'` para que «Atrás» funcione con enlace directo).
- [x] Pestaña Buscar retirada (`href: null`; `/search` redirige a `/`): el buscador de Pedidos ya busca en todo.
- [x] Cabeceras de navegación ocultas en Pedidos, Fabricantes y Ajustes (cada pantalla tendrá su propia cabecera).
- [x] `components/Page.tsx` (`PageHeader`, `usePageLayout`, ancho común `PAGE_MAX = 1280`, márgenes 16/24/32) y `components/Button.tsx` (botón común de 44 px).

Terminado el 16/11/2026:
- [x] `PageHeader` + `usePageLayout` en Pedidos, Fabricantes y Ajustes; ficha y formulario con el mismo ancho máximo (1.280 px) y márgenes. Ajustes usa una columna de lectura de 820 px alineada a la izquierda; Fabricantes, dos columnas desde 1.024 px.
- [x] En móvil, botón «+ Nuevo» en la cabecera de Pedidos (`header-new-order`); en tablet y ordenador está en la barra lateral. Botón flotante retirado.
- [x] Vista «Por año y fabricante»: sin «Atrás» (migas de pan «Años › año › fabricante»), pedidos con `OrderTable` (≥ 1.100 px) u `OrderCardItem` (1 o 2 columnas). Duplicar un pedido sigue disponible desde su ficha. Sigue pendiente de decisión si pasa a ser «agrupar por» dentro de la lista.
- [x] Pruebas ajustadas: t2 usa `header-new-order`; t4 busca con `home-search` (ya no existe la pestaña Buscar); `ControlOrMeta+a` para que funcionen también en Mac. Nueva `tools/e2e/shots-carpetas.js` (capturas de la vista por año en 3 tamaños).

## Sistema de diseño estilo Apple (publicado el 16/11/2026)

Pedido del propietario el 16/11/2026: estética de Apple (tipografía, colores, translucidez) que funcione en web y como app de móvil.
- [x] Tokens nuevos en `constants/colors.ts`: azul del sistema como único color de acción, estados con colores de sistema, `SystemTint` para iconos de colores, vidrio (`glass*`) y brillo de fondo (`ambient`). Contrastes ≥ 4,5:1 comprobados.
- [x] Tipografía: SF en Mac/iPhone, Inter (Google Fonts) en el resto; título grande de 34 px como en iOS. Idioma de la página `es`.
- [x] Navegación: barra lateral translúcida de macOS con iconos de colores e icono de la app con degradado; en móvil, barra de pestañas flotante de vidrio (`TAB_BAR_SPACE` reserva su sitio al final de las listas).
- [x] Barra de título de vidrio que aparece al desplazarse (`useCollapsingTitle` + `CompactTitleBar`) en Pedidos y Ajustes.
- [x] Pedidos: contadores como las listas de Recordatorios (en móvil, desplazables en horizontal), buscador de iOS, lista agrupada en móvil, títulos sin mayúsculas.
- [x] Ajustes: iconos en cuadrados de color. Entrada rehecha con el estilo de la app (se quita «Análisis · Métricas en vivo», que no existía).
- [x] Aprobado por el propietario y fusionado con `main`.
- [x] Ficha del pedido: cabecera de iOS («‹ Pedidos», duplicar y «…»), título grande, estado que se toca para cambiarlo, total arriba, secciones agrupadas (resumen económico como lista, no bloque negro). En móvil los productos se ven en la primera pantalla.
- [x] Formulario: barra de hoja de iOS (Cancelar · título · Leer documento), secciones agrupadas, un solo botón de guardar (abajo, con el total).
- [x] Modo oscuro arreglado: el tema de la navegación pintaba un gris claro fijo detrás de las pantallas (`app/_layout.tsx`).
- [x] Arreglado: al abrir el formulario por enlace directo, el fabricante no salía marcado si los pedidos llegaban antes que los fabricantes.
- [x] Arreglado (16/11/2026): las pantallas se veían unas encima de otras al cambiar de pestaña o volver atrás. Las escenas de la navegación tenían fondo transparente y las inactivas siguen pintadas debajo; ahora su fondo es opaco (`sceneBackground`). Prueba: `t11-solapes.js`.
- [ ] Probar en un iPhone real (Safari) y con el teclado abierto.
- Nota: en `t5-scan.js`, «muestra progreso» falla por tiempos (el PDF de muestra se lee en menos de 0,4 s); el resto pasa.

## Rediseño con la marca Alpha Omega (17/11/2026)

Pedido del propietario: más color y aprovechar el ancho; que la referencia y los datos del cliente se vean de un golpe, como su Excel; buscador en cada año y fabricante. Base: alphaomega-electronics.com (azul petróleo #002A39, naranja #FF8718, azul acero #7FA4B7, Figtree).
- [x] Paleta de marca (`constants/colors.ts`: `brand`, `reference`, `onPrimary`, `nav*`), Figtree, botón principal naranja con texto azul petróleo (6,3:1), barra lateral azul petróleo.
- [x] Ancho máximo 1.600 px. Lista: referencia en naranja, cliente, contacto (teléfono y email), población y calle, fabricante y año, estado con retraso en una línea, total.
- [x] Ficha estilo Excel: cabecera con referencia y total, tarjeta Cliente destacada (teléfono y email con enlace), Pedido y documentos, productos en tabla (≥ 1.200 px), dos columnas sin huecos.
- [x] Buscadores en «Por año y fabricante»: todos los años, un año y un fabricante (`components/SearchField.tsx`, `matchesQuery`). Prueba: `t12-buscadores.js`.
- [x] Formulario con la marca: secciones con icono naranja; Cliente en el orden del Excel (rejilla de 3), Documentos debajo; en ordenador, Pedido y Resumen con «Guardar» fijos a la derecha; productos en tabla editable desde 1.680 px (tarjetas por debajo).

## Fase 2 · Pantalla por pantalla

- [x] Pedidos: contadores compactos que filtran, aviso de atención en una línea que filtra la lista (con «Ver retrasados»), la lista visible desde la primera pantalla, tabla desde 1.100 px y tarjetas en 1 o 2 columnas.
- [ ] Ficha: cabecera compacta (referencia, estado, total y acciones en dos líneas); en móvil los productos deben verse en la primera pantalla.
- [x] Formulario: fabricante en un selector con buscador (`SelectSheet searchable`, sin acentos); «Leer documento» en la barra superior; un solo botón de guardar.
- [x] Formulario: en móvil, «Seguimiento» y «Documentos y condiciones» se pliegan en una línea si están vacías (se abren solas si tienen datos).
- [x] Formulario en horizontal (alto < 500 px): una sola barra arriba con Cancelar, título con el total (o los datos que faltan) y Guardar; sin barra inferior. Pasa de ~270 a ~340 px útiles.
- [x] Fabricantes: tabla en ordenador, lista agrupada en móvil; tocar la fila edita; acciones con nombre en el menú «…».
- [x] Ajustes como Ajustes de iOS: perfil → apariencia → resumen → usuarios → cuenta → datos → cerrar sesión. Fuera «Estado de pedidos» y «Plataforma».
- [x] «Facturación total» ya no suma los pedidos cancelados (aprobado por el propietario el 16/11/2026); la nota de debajo dice cuántos no cuenta.
- [ ] Entrar (`app/login.tsx`): mismo estilo claro que la app; quitar «Análisis · Métricas en vivo» y similares, que no existen. Mantener alta del primer admin, recuperar contraseña y mostrar/ocultar contraseña.

## Fase 3 · Acabado y accesibilidad

- [ ] Contraste: `textTertiary` está en 2,9–3,3:1 en modo claro (mínimo 4,5:1); `success` 4,4:1.
- [ ] Objetivos táctiles de 44 px (filtros 40 px, «Cambiar estado» 36 px, enlaces de texto).
- [ ] Foco visible y navegación con teclado en todas las pantallas.
- [ ] Revisar estados vacíos, de carga y de error.
- [ ] Importes siempre con punto de miles (2.670,47 €) **si el propietario lo aprueba**.

## Fase 4 · Propuestas de negocio (solo con aprobación)

- [ ] Fichas de clientes reutilizables (hoy el cliente se copia en cada pedido).
- [ ] Campos de la hoja original que faltan: Población y Vencimiento del recibo.

## Decisiones pendientes del propietario

1. Pausa de Supabase: ¿plan Pro o llamada automática (GitHub Actions)?
2. ¿Vista «Por año y fabricante» como pantalla aparte o como «agrupar por» en la lista?
3. ¿Importes con punto de miles siempre?
4. ¿Exportación a Excel con las mismas columnas y orden que su hoja actual? (pedir una hoja vacía de ejemplo)
5. ¿Fichas de clientes? ¿Población y Vencimiento del recibo como campos?
6. ¿«Enviado» = enviado por el fabricante o entregado al cliente?
7. Al leer documentos, ¿los precios son de venta o de coste? (hoy se asume venta, con opción de cambiar en la revisión)
8. ¿Quién más usará la app y con qué permisos?

## Cómo se da por terminada cada fase

1. `npx tsc --noEmit` y `eslint` limpios.
2. Pruebas de `tools/` en verde (e2e, cálculos y, si se toca el lector, `docread/check.ts`).
3. Capturas con `tools/e2e/shots.js` en 6 tamaños, claro y oscuro, con 5 y con 300 pedidos: sin desplazamiento lateral, nada flotando ni tapado.
4. Datos intactos en Supabase (contar pedidos y fabricantes antes y después).
5. Push a `main`, despliegue en Vercel en estado READY y comprobación en https://ao-gestiones-pedidos.vercel.app.
