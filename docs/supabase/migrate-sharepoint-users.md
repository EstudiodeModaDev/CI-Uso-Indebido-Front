# Edge Function: `migrate-sharepoint-users`

Primera versión de la migración de usuarios desde una lista de SharePoint hacia Supabase Auth, `PERSONAS`, `USUARIOS` y `USUARIOS_ROLES`. Fue reemplazada por [sincronizacion-you](sincronizacion-you.md), que es más completa (conflictos, reparación, compensación, `dryRun`, filtros).

- **Código:** [supabase/functions/migrate-sharepoint-users/](../../supabase/functions/migrate-sharepoint-users)
- **La invoca:** cron o llamada manual. El front no la usa.
- **Método:** `POST`
- **Despliegue:** `supabase functions deploy migrate-sharepoint-users --no-verify-jwt` (no tiene bloque en `config.toml`).

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `index.ts` | Autorización, lotes, creación/estado en Auth, escritura en tablas, log y cursor |
| `graph.ts` | Token de Graph (client credentials) y descarga de **todos** los ítems de la lista (`$top=200`, siguiendo `@odata.nextLink`) |
| `config.ts` | Mapeo de campos SharePoint → columnas, nombres de tablas, rol por defecto y parámetros de lote |

## Autorización

Solo el header `x-migration-secret: <MIGRATION_SECRET>`. Si falta o no coincide → `401`. Un método distinto de `POST` → `405`.

## Request

| Campo | Por defecto | Descripción |
| --- | --- | --- |
| `limit` | `CONFIG.batch.defaultLimit` = **350** | Ítems a procesar en la invocación |
| `offset` | Valor de `migration_cursor` | Índice inicial; si se envía, el cursor no se actualiza |

## Configuración (`config.ts`)

| Clave | Valor |
| --- | --- |
| `sharepoint.emailField` / `cedulaField` / `activeField` | `email` / `cedula` / `estado_contrato` |
| `sharepoint.activeTruthyValues` | `["Activo"]` (comparación exacta) |
| `tables.personas.fieldMap` | `numero_documento ← cedula`, `nombres ← nombres`, `apellidos ← primer_apellido + segundo_apellido`, `correo ← email`, `telefono ← celular`, `estado ← estado_contrato` en mayúsculas |
| `tables.usuarios.fieldMap` | `correo ← email`, `estado ← estado_contrato` en mayúsculas; `upsert` por `auth_user_id` |
| `usuariosRoles.defaultRolId` | `2`, asignado solo al crear el usuario en Auth |
| `logs.table` | `LOG` |
| `batch.maxRuntimeMs` | `50000` (corta el lote antes del límite de ejecución) |

## Procesamiento por ítem

1. Sin correo → error.
2. Inactivo en SharePoint y no existe en Auth → `skipped`.
3. No existe en Auth → lo crea con `password = cedula` (`created`).
4. Existe en Auth:
   - Inactivo y no baneado → ban de `87600h` (~10 años) → `deactivated`.
   - Activo y baneado → quita el ban → `reactivated`.
   - En otro caso → `existing`.
5. **Siempre** inserta una fila nueva en `PERSONAS` y hace `upsert` de `USUARIOS` por `auth_user_id` apuntando a esa persona.
6. Si se creó en Auth, inserta `USUARIOS_ROLES` con el rol `2`.
7. Escribe una fila en `LOG` (`accion: "Creación de usuario run ID: <uuid>"`, `entidad: "user_creation"`).

> **Atención:** el paso 5 inserta un `PERSONAS` nuevo en cada ejecución, también para usuarios que ya existían, así que cada corrida deja registros de persona huérfanos o duplicados. Es una de las razones para usar `sincronizacion-you` en su lugar.

## Respuesta

```json
{
  "runId": "…",
  "totalEnSharePoint": 1200,
  "offset": 0,
  "procesados": 350,
  "creados": 4, "existentes": 340, "desactivados": 3, "reactivados": 1, "omitidos": 2, "errores": 0,
  "erroresDetalle": [],
  "done": false,
  "nextOffset": 350
}
```

## Variables de entorno

| Variable | Obligatoria |
| --- | --- |
| `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_SITE_ID`, `MS_LIST_ID` | Sí |
| `MIGRATION_SECRET` | Sí |
| `SUPABASE_URL` | Sí (automática) |
| `SB_STATIC_SECRET_KEY` / `SUPABASE_SECRET_KEYS` / `SUPABASE_SERVICE_ROLE_KEY` | Una de ellas |

## Diferencias con el README de la función

El [README de la función](../../supabase/functions/migrate-sharepoint-users/README.md) menciona un lote por defecto de 200 y logs en `migration_logs`; el código usa 350 y escribe en `LOG`.
