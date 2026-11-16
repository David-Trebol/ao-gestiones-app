# Riesgos conocidos

- **El plan gratis de Supabase pausa la base de datos tras 7 días sin uso** (pasó el 13/11/2026; se reactivó pausando el proyecto «TaskFlow»). Opciones pendientes de decisión del propietario: plan Pro, o una tarea programada que llame a `keepalive()` (por ejemplo, un workflow de GitHub Actions cada 3 días; crearlo requiere su aprobación).
- No hay copia de seguridad descargable salvo la exportación a Excel (rama fase-1).
- «Eliminar todos los datos» (Ajustes, solo admin) borra todo con una confirmación: endurecerlo es parte de la fase 0.
- Sin comprobar: a qué dirección devuelve el correo de «He olvidado mi contraseña» (Site URL de Supabase Auth) y la protección de contraseñas filtradas.
- La app descarga todos los pedidos al entrar: bien hasta unos miles; más allá habrá que paginar.
