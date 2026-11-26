# Pruebas (tools/)

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
PORT=8780 node e2e/t10-fase2.js              # selector de fabricante con buscador, menú de fabricantes, copia completa, borrado protegido
PORT=8780 node e2e/t11-solapes.js            # que al cambiar de pantalla no se vea la anterior por debajo (BASE=https://… para probar la web publicada)
PORT=8780 node e2e/t12-buscadores.js         # buscadores de todos los años, de un año y de un fabricante
PORT=8780 node e2e/t13-solapes-elementos.js  # detector de elementos que se pisan o se salen, en 7 tamaños, claro y oscuro (BIG=1 con 300 pedidos; BASE=https://… para la web publicada)
PORT=8780 node e2e/t20-cabeceras.js         # cabeceras de seguridad (CSP): entrar, leer PDF y foto, Excel (BASE=https://… para las reales)
PORT=8780 node e2e/t14-ficha.js              # editar la referencia manual desde la ficha (✓, ✗ y Enter)
node e2e/shots-dark.js 8780                  # capturas en modo oscuro; también shots-login.js y shots-carpetas.js
node e2e/shots.js <prefijo> 8780 [normal|big] home,detail,form,manufacturers,settings   # capturas en 6 tamaños + comprobación de desbordes
cd unit && bun run calc.test.ts              # fórmulas
cd docread && bun run check.ts               # lector con los 7 documentos de muestra (necesita pdfjs-dist 3.11 y tesseract con «spa»)
```

`seed.js` = 5 pedidos de ejemplo; `seedbig.js` = 300 pedidos con nombres largos, importes grandes y 40 líneas. Capturas y resultados en `tools/out/` (ignorado por git). Las pruebas de `tools/e2e` están ajustadas a la interfaz publicada (diseño estilo Apple y fase 2).
