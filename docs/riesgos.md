# Riesgos conocidos

- **El plan gratis de Supabase pausa la base de datos tras 7 días sin uso** (pasó el 13/11/2026). Mitigado desde el 16/11/2026: el workflow `keepalive-supabase.yml` llama a `keepalive()` cada 3 días. Si una ejecución falla, GitHub avisa por email al propietario; revisar la pestaña Actions de vez en cuando. Si aun así se pausa, reactivarla en el panel de Supabase (el plan gratis solo permite 2 proyectos activos).
- No hay copia de seguridad descargable salvo la exportación a Excel (rama fase-1).
- «Eliminar todos los datos» (Ajustes, solo admin) borra todo con una confirmación: endurecerlo es parte de la fase 0.
- Sin comprobar: a qué dirección devuelve el correo de «He olvidado mi contraseña» (Site URL de Supabase Auth) y la protección de contraseñas filtradas.
- La app descarga todos los pedidos al entrar: bien hasta unos miles; más allá habrá que paginar.
