# Historial del proyecto (conversación con el propietario)

Resumen de todo lo hablado y decidido con el propietario (David) desde que la app salió de Rork hasta el 24/11/2026. Sirve para que una sesión nueva de Claude Code sepa **por qué** las cosas son como son. El estado técnico al día está en `docs/PLAN.md`; las reglas, en `CLAUDE.md`.

> El repositorio es público: aquí no hay correos, contraseñas ni datos de clientes. No los añadas.

## Cómo trabaja el propietario

- Escribe en español, a menudo por voz y con prisa: mensajes largos, con erratas («clawd code» = Claude Code, «planin» = planning). Interpretar la intención, no la letra.
- Revisa **siempre en la web publicada** (https://ao-gestiones-pedidos.vercel.app), sobre todo en ordenador y móvil. Si un cambio no está publicado, para él no existe («publícalo ya, para que se vean los cambios»).
- Valora que se le diga claramente qué está hecho, qué está probado y qué falta. No le gustan las sorpresas con sus datos.
- Le gusta ver referencias visuales (capturas del Excel antiguo, un vídeo de TikTok) y que se adapte el estilo, **no** que se cambie lo que guarda la app.
- Aprueba o rechaza propuestas con frases cortas («vale», «hazlos», «actívalo pausando otra cosa»). Las decisiones de negocio y de dinero (plan de pago, pausar proyectos, borrar datos) son suyas: preguntar antes.

## Línea de tiempo

### Octubre 2026 · Salir de Rork
- La app («Flow», luego «AO Gestiones») estaba hecha en Rork. Pidió sacarla y trabajarla en local, con una base de datos real para comprobar que guarda bien.
- Se eligió **Supabase** (proyecto «AO Gestiones», París, plan gratis), **Vercel** para la web y un **repositorio GitHub nuevo y público** (no el antiguo «AO-Gestiones»).
- En su Mac quedó una copia antigua sin git en `~/Documents` (`expo/`, `ios-floworders/`, `rork.json`) y `~/Documents/AO-Gestiones/` (zip original, hoja `AO-Gestiones-Supabase.xlsx`, `Documentos-de-prueba/` con los documentos de muestra). No son la fuente de verdad: lo es este repositorio.

### 30/10/2026 · Lectura de documentos sin IA
- Primero se probó una función Edge con IA (`extract-order`). **El propietario la rechazó**: «no uses ninguna IA anexada… necesito que sea sin API… pero que lo haga bien».
- Se rehízo todo en el navegador: PDF.js para PDF con texto y Tesseract (español) para fotos y escaneados, servidos desde `expo/public/vendor`, más reglas propias (NIF/CIF/NIE con letra de control, CP → provincia, emisor/cliente, líneas que cuadran cantidad × precio − dto, IVA y totales). Corrección de inclinación y prueba de giros para fotos malas.
- Pantalla de revisión: nada se aplica sin marcarlo y nunca se pisa un dato existente. `extract-order` quedó desactivada (410). Detalle en `docs/lectura-documentos.md`.
- Regla fija desde entonces: **cada cambio se publica en Vercel** para que él lo vea.

### Principios de noviembre · Rediseño y seguimiento
- Se aplicó un rediseño de UX: inicio con resumen y filtros, ficha del pedido con resumen arriba, formulario por secciones, marca «AO Gestiones» en vez de «Flow».
- Enseñó una captura de su **Excel antiguo** (un bloque por pedido: Empresa, Contacto, Dpto., Su pedido-Nº Ref, Dir. 1/2, CP-Población, Provincia/País, Telf. 1/2, Email, NIF, Oferta/Proforma, Cond. Entrega, Cond. Pago, FRA/Vcto. Recibo) «para que lo veas, no que modifiques». Aprobó los apartados de seguimiento propuestos: **fecha prevista, responsable, siguiente acción y aviso de retraso** (columnas `expected_date`, `owner`, `next_action`, opcionales).

### 13/11/2026 · «No me deja entrar»
- Pidió credenciales y luego que se cambiaran. La causa real: **Supabase había pausado el proyecto** por 7 días sin uso. El plan gratis solo permite 2 proyectos activos; con su permiso se **pausó «TaskFlow»** y se reactivó AO Gestiones. Nunca se le escribió ni eligió contraseña (regla 8 de `CLAUDE.md`).

### 16/11/2026 · Auditoría, plan y paso a Claude Code
- Pidió revisar la app entera («tiene que ser responsive con todo… herramienta interna para la gestión de pedidos de la empresa») y hacer un plan de mejoras antes de tocar nada. Auditoría con capturas: https://claude.ai/artifact/MmmE6qeFAjeX4QpSss1KRu → `docs/PLAN.md` (fases 0–4).
- Aprobó aplicar el plan y después **pasar la gestión a Claude Code**: se crearon `CLAUDE.md`, `docs/`, `tools/` (pruebas con Supabase simulado) y los agentes `.claude/agents` (revisor-ux, qa-pruebas, datos-supabase).
- Aprobó la **llamada automática cada 3 días** (`.github/workflows/keepalive-supabase.yml`) para que Supabase no se pause, y que «Facturación total» no sume los cancelados.
- Ese mismo día, en Claude Code: fase 1 terminada, estética estilo Apple, formulario plegable y en horizontal, arreglo de pantallas solapadas.

### 17/11/2026 · Marca Alpha Omega
- Pidió más color, aprovechar el ancho y ver referencia y cliente «de un golpe, como su Excel». Se tomó la marca de alphaomega-electronics.com: azul petróleo `#002A39`, naranja `#FF8718`, azul acero `#7FA4B7`, tipografía Figtree. Entrada, lista, ficha (como una factura), formulario, Fabricantes, Ajustes y vista por año rehechos con la marca. Auditoría con detector de solapes.

### 19/11/2026 · Vídeo de TikTok: «vidrio cálido» y pedidos como el Excel
- Mandó un TikTok (https://vm.tiktok.com/ZN8aGXAS3/) con un panel de estilo translúcido («Glassy dashboard»: colores, posición, partes translúcidas) y pidió:
  1. un «plugin» para adaptar la web a ese estilo → se hizo como **skill del proyecto** `.claude/skills/estilo-vidrio-ao/SKILL.md` (reglas del estilo) + piezas `panel`, `heroFill`, `liquidGlass`, `colors.ambient`;
  2. reordenar los pedidos, que eran «un tocho de información», poniendo primero lo importante: **nombre del cliente, referencia, importe total, cantidad de productos, breve descripción de productos y dirección**, como en el Excel «que entrabas y veías todo de una».
- Resultado en `main` (commits `a586334` y `a7508d1`): fondo cálido difuminado, paneles de vidrio, una tarjeta naranja protagonista, barra lateral navy flotante, lista en bloques cliente | pedido | productos | total, ficha con cliente, dirección, contacto, productos y total arriba; animaciones que respetan «reducir movimiento»; «Pedidos» en la navegación vuelve siempre a la lista.
- **Sin confirmar por el propietario** que el resultado se parece a lo que quería del vídeo (Claude no puede ver vídeos de TikTok; se trabajó con su descripción). Si dice que no, pedirle capturas del vídeo.

## Decisiones ya tomadas (no volver a preguntar)

| Tema | Decisión |
|---|---|
| Lectura de documentos | Sin IA ni APIs externas; PDF.js + Tesseract en el navegador |
| Publicación | Cada cambio a `main` y comprobado en la URL de Vercel |
| Pausa de Supabase | Llamada a `keepalive()` cada 3 días con GitHub Actions (no plan Pro) |
| Facturación total | Sin pedidos cancelados |
| Marca | Alpha Omega (azul petróleo, naranja, azul acero, Figtree) |
| Estilo | «Vidrio cálido» según `.claude/skills/estilo-vidrio-ao` |
| Seguimiento | Fecha prevista, responsable, siguiente acción, aviso de retraso |
| Proyecto TaskFlow | Pausado para dejar sitio a AO Gestiones (plan gratis: 2 activos) |

## Decisiones que siguen abiertas

Ver la lista al final de `docs/PLAN.md` (vista «Por año», punto de miles, columnas del Excel exportado, fichas de clientes, Población y Vencimiento del recibo, significado de «Enviado», precios de venta o coste al leer documentos, otros usuarios y permisos). Además:
- Confirmar que el estilo del TikTok quedó como quería.
- Comprobar en Supabase Auth el Site URL del correo de recuperar contraseña y activar la protección de contraseñas filtradas (lo tiene que hacer él en el panel o aprobarlo).
- Probar en un iPhone real.

## Cómo empezar una sesión nueva

1. Leer `CLAUDE.md`, este archivo y `docs/PLAN.md`.
2. `git pull` y mirar el último despliegue en Vercel antes de tocar nada.
3. Preguntarle qué quiere ver primero; trabajar en una rama, probar con `tools/`, fusionar en `main`, comprobar la web publicada y contarle en español qué cambió y qué queda.
