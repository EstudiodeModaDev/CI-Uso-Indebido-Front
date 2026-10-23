# Supabase: proyecto, migraciones y Edge Functions

La carpeta [supabase/](../../supabase) contiene la configuración de la CLI de Supabase, las migraciones SQL y las Edge Functions (Deno) del proyecto.

El modelo de datos completo de la base (tablas, relaciones, estados y quién lee o escribe cada tabla) está en [modelo-de-datos.md](modelo-de-datos.md).

## Edge Functions

| Función | Propósito | Disparador | Autenticación | `verify_jwt` | Doc |
| --- | --- | --- | --- | --- | --- |
| `bulk-create-users` | Crear/actualizar usuarios desde el Excel de control interno | Front (`supabase.functions.invoke`) | JWT de Supabase + rol `CONTROL_INTERNO` | `true` (por defecto) | [bulk-create-users.md](bulk-create-users.md) |
| `sincronizacion-you` | Sincronizar empleados desde la lista de SharePoint "YOU" | Cron / manual | Secreto `MIGRATION_SECRET` | `false` | [sincronizacion-you.md](sincronizacion-you.md) |
| `migrate-sharepoint-users` | Migración inicial (versión anterior de la sincronización) | Cron / manual | Header `x-migration-secret` | Desplegar con `--no-verify-jwt` | [migrate-sharepoint-users.md](migrate-sharepoint-users.md) |
| `keep-db-awake` | Lectura liviana para que la base no se suspenda | Cron | Secreto `KEEP_AWAKE_SECRET` | `false` | [keep-db-awake.md](keep-db-awake.md) |
| `ping-backend-health` | Ping al `/api/health/` del backend para que no se duerma | Cron | Secreto `PING_HEALTH_SECRET` | `false` | [ping-backend-health.md](ping-backend-health.md) |

Cada función tiene además un `README.md` propio junto a su código en `supabase/functions/<nombre>/`, con ejemplos de `curl` y de programación con `pg_cron`.

### Convenciones comunes

- Runtime Deno con `Deno.serve`; cada función tiene un `deno.json` con `strict: true`.
- Cliente de Supabase importado como `npm:@supabase/supabase-js@2` y creado con la clave de servicio (`autoRefreshToken: false`, `persistSession: false`), por lo que **no** pasan por RLS.
- Respuestas JSON con cabeceras CORS abiertas (`Access-Control-Allow-Origin: *`) y manejo de `OPTIONS`.
- Las funciones invocadas por cron se protegen con un secreto compartido propio y se configuran con `verify_jwt = false`, porque el cron no tiene un JWT de usuario.

### Claves de servicio

Las funciones buscan la clave de servicio en este orden (no todas soportan las tres):

| Variable | `bulk-create-users` | `migrate-sharepoint-users` | `sincronizacion-you` | `keep-db-awake` |
| --- | --- | --- | --- | --- |
| `SB_STATIC_SECRET_KEY` (manual) | 1° | 1° | — | — |
| `SUPABASE_SECRET_KEYS` (JSON, automática) | 2° | 2° | 2° | — |
| `SUPABASE_SERVICE_ROLE_KEY` (automática, *legacy*) | 3° | 3° | 1° | única |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_SECRET_KEYS` las inyecta Supabase automáticamente en el entorno hospedado.

### Despliegue

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

# Secretos (una vez, o al rotarlos)
supabase secrets set NOMBRE=valor ...

# Funciones
supabase functions deploy bulk-create-users
supabase functions deploy sincronizacion-you
supabase functions deploy migrate-sharepoint-users --no-verify-jwt
supabase functions deploy keep-db-awake
supabase functions deploy ping-backend-health

# Logs
supabase functions logs <nombre>
```

Para probar en local: `supabase functions serve <nombre> --env-file supabase/functions/.env`.

## Configuración (`config.toml`)

[supabase/config.toml](../../supabase/config.toml) es la configuración de la CLI para el entorno **local** (`supabase start`). Puntos relevantes:

- `project_id = "uso-indebido-front"`; Postgres 17.
- API REST con `max_rows = 1000` (límite de filas por respuesta de PostgREST).
- Auth: `jwt_expiry = 3600`, rotación de *refresh tokens* activada, `minimum_password_length = 6`, sin confirmación de correo en local.
- Bloques `[functions.<nombre>] verify_jwt = false` para `sincronizacion-you`, `keep-db-awake` y `ping-backend-health`.

## Migraciones

| Archivo | Qué crea |
| --- | --- |
| [20260723000000_migration_users_tables.sql](../../supabase/migrations/20260723000000_migration_users_tables.sql) | `PERSONAS`, `USUARIOS`, `migration_logs`, `migration_cursor` (con RLS y sin políticas) |
| [20260724000000_create_reportes_table.sql](../../supabase/migrations/20260724000000_create_reportes_table.sql) | `REPORTES` con políticas de `insert`/`select` para `authenticated` |

> Estas migraciones están **desactualizadas** respecto a la base real. El esquema vigente de `PERSONAS` y `USUARIOS` (PK autogeneradas, `id_persona`, `auth_user_id`, `requiere_cambio_password`, etc.) se modificó directamente en la base, y el front registra los reportes en `REPORTES_USO_INDEBIDO`, no en `REPORTES`. Las tablas `ROLES`, `USUARIOS_ROLES` y `LOG` no tienen migración en este repositorio. No ejecutes `supabase db push` contra producción con estos archivos sin revisarlos. El esquema que usa el código está en [modelo-de-datos.md](modelo-de-datos.md).

## Tareas programadas recomendadas

| Job | Frecuencia sugerida | Función |
| --- | --- | --- |
| Sincronización de empleados | Cada dos dias| `sincronizacion-you` |
| Mantener la base activa | Cada 15 min | `keep-db-awake` |
| Mantener el backend activo | Cada 5 min | `ping-backend-health` |

Se programan con `pg_cron` + `pg_net` o desde **Integrations → Cron Jobs** en el dashboard. Guarda los secretos en Supabase Vault en lugar de escribirlos en texto plano dentro del job.
