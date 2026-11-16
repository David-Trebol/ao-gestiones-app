# AO Gestiones · Libro de pedidos

Herramienta interna para gestionar los pedidos de la empresa: pedidos (con los datos del cliente dentro), fabricantes, años, usuarios y seguimiento. Sustituye a una hoja de Excel (un bloque por pedido con Empresa, Contacto, Dpto., Su pedido-Nº Ref, Dir. 1/2, CP-Población, Provincia/País, Telf. 1/2, Email, NIF, Oferta/Proforma, Cond. Entrega, Cond. Pago, FRA/Vcto. Recibo).

- **Web publicada:** https://ao-gestiones-pedidos.vercel.app (Vercel publica sola cada `git push` a `main`).
- **Repositorio:** github.com/David-Trebol/ao-gestiones-app (público: no subas nada privado).
- **Base de datos:** Supabase, proyecto «AO Gestiones», id `ixsosbtieclihoizmszq`, región París, plan gratis.
- **Índice de docs:** al final de este archivo.

## Reglas del propietario (obligatorias)

1. **Todo en español**: interfaz, mensajes de error, commits y explicaciones.
2. **Después de cada cambio, publícalo y compruébalo en la URL de Vercel** antes de decir que está hecho. El propietario revisa siempre en la web publicada.
3. **Responsive de verdad**: cada cambio se comprueba en móvil (320, 390, 844×390 horizontal), tablet (768) y ordenador (1024, 1440, 1920). No basta con que «quepa»: orden, jerarquía y nada flotando ni tapando contenido.
4. **No cambiar la lógica de negocio sin permiso**: fórmulas de importes, significado de los estados, referencias y datos guardados. Las mejoras visuales se hacen; lo que cambia datos o forma de trabajar se propone y se espera respuesta.
5. **Sin migraciones destructivas** y sin pérdida de datos. Columnas nuevas siempre opcionales.
6. **La lectura de documentos no usa IA ni servicios externos** (decisión del propietario): PDF.js + OCR Tesseract en el navegador, con reglas propias. No añadir APIs de IA.
7. **No afirmar haber probado algo que no se ha probado.** Separar lo comprobado de lo que queda por comprobar.
8. **Nunca escribir ni elegir contraseñas del propietario** ni de otros usuarios.

## Pila

Expo SDK 54 + React Native Web + expo-router, Supabase (RLS), React Query. Gestor **bun**. TypeScript estricto. Código en `expo/`.

## Comandos

```bash
cd expo && npx tsc --noEmit && npx eslint app components utils   # deben salir limpios
npx expo export --platform web --output-dir ../tools/out/dist     # compilación como en Vercel
```

## Docs (abre solo el que necesites)

- `docs/PLAN.md` — plan por fases y estado; léelo antes de cualquier tarea.
- `docs/estructura.md` — mapa de carpetas y rutas; al buscar dónde está algo.
- `docs/datos.md` — tablas, RLS, funciones Edge, estados y referencias; al tocar datos o Supabase.
- `docs/formulas.md` — fórmulas de importes; antes de tocar `utils/calculations.ts` o importes.
- `docs/lectura-documentos.md` — lector PDF/OCR; al tocar `utils/docread` o `DocumentReview`.
- `docs/pruebas.md` — e2e con Supabase simulado, capturas y tests unitarios; al probar.
- `docs/riesgos.md` — riesgos abiertos (pausa de Supabase, copias, etc.); al planificar o desplegar.
