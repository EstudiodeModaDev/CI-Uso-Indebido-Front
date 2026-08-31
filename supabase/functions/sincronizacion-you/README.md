# sincronizacion-you

Edge Function para sincronizar usuarios desde una lista de SharePoint hacia Supabase Auth y las tablas publicas `"PERSONAS"`, `"USUARIOS"`, `"USUARIOS_ROLES"` y `"LOG"` sin modificar el esquema existente.

## Estructura

```text
supabase/
└── functions/
    └── sincronizacion-you/
        ├── auth.service.ts
        ├── config.ts
        ├── database.service.ts
        ├── deno.json
        ├── graph.service.ts
        ├── index.ts
        ├── log.service.ts
        ├── README.md
        ├── sync.service.ts
        ├── types.ts
        ├── utils.ts
        └── validators.ts
```

## Variables de entorno requeridas

- `MS_TENANT_ID`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`
- `MS_SITE_ID`
- `MS_LIST_ID`
- `MIGRATION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEYS`
- `DEFAULT_ROLE_ID`

Opcionales:

- `GRAPH_TIMEOUT_MS`
- `AUTH_MINIMUM_PASSWORD_LENGTH`
- `AUTH_PASSWORD_REQUIREMENTS`

## Comportamiento importante

- La funcion acepta solo `POST` y `OPTIONS`.
- La autorizacion se valida con `Authorization: Bearer {MIGRATION_SECRET}` o `x-migration-secret: {MIGRATION_SECRET}`.
- Para esta funcion debe configurarse `verify_jwt = false`.
- `dryRun` consulta SharePoint y calcula acciones, pero no escribe en Auth ni en tablas publicas.
- La funcion trabaja por batches usando `limit` y `offset`.
- Si no envias `offset`, intenta continuar desde `public.migration_cursor.next_offset`.
- Al finalizar una ejecucion real sin `offset` manual, guarda el `nextOffset` en `public.migration_cursor`.
- Se procesa secuencialmente para mantener consistencia por usuario.
- Se usa `supabase.auth.admin` para Auth. No hay acceso SQL directo a `auth.users`.
- Se siguen las paginas de Graph con `@odata.nextLink`, validando que pertenezcan a `https://graph.microsoft.com`.
- Los fallos por registro no detienen toda la ejecucion.
- La funcion escribe inicio y fin en `LOG`; los errores de logging no detienen la sincronizacion.

## Ejemplos de prueba manual

Ejecucion normal:

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer MIGRATION_SECRET' \
  --data '{
    "dryRun": false
  }'
```

Simulacion:

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer MIGRATION_SECRET' \
  --data '{
    "dryRun": true,
    "limit": 10
  }'
```

Batch manual desde un offset:

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer MIGRATION_SECRET' \
  --data '{
    "dryRun": true,
    "limit": 25,
    "offset": 50
  }'
```

Por correo:

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer MIGRATION_SECRET' \
  --data '{
    "email": "usuario@empresa.com"
  }'
```

Por cedula:

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer MIGRATION_SECRET' \
  --data '{
    "cedula": "123456789"
  }'
```

Por elemento de SharePoint:

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer MIGRATION_SECRET' \
  --data '{
    "sharePointItemId": "25"
  }'
```

Sobrescribiendo el rol:

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer MIGRATION_SECRET' \
  --data '{
    "roleId": 2
  }'
```

Usando `x-migration-secret`:

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'x-migration-secret: MIGRATION_SECRET' \
  --data '{
    "dryRun": false
  }'
```

## Despliegue

1. Iniciar sesion en Supabase CLI.

```bash
supabase login
```

2. Vincular el proyecto.

```bash
supabase link --project-ref PROJECT_REF
```

3. Registrar secretos.

```bash
supabase secrets set \
  MS_TENANT_ID="..." \
  MS_CLIENT_ID="..." \
  MS_CLIENT_SECRET="..." \
  MS_SITE_ID="..." \
  MS_LIST_ID="..." \
  MIGRATION_SECRET="..." \
  DEFAULT_ROLE_ID="..."
```

Nota: segun la documentacion oficial actual de Supabase sobre secretos de Edge Functions, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` existen como secretos por defecto en el entorno hospedado. La misma documentacion tambien lista `SUPABASE_SECRET_KEYS` como alternativa moderna. Por eso no hace falta registrar manualmente `SUPABASE_SERVICE_ROLE_KEY` salvo que uses un entorno personalizado.

4. Desplegar la funcion.

```bash
supabase functions deploy sincronizacion-you
```

5. Probarla.

```bash
curl --request POST \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer MIGRATION_SECRET' \
  --data '{
    "dryRun": true,
    "limit": 5
  }'
```

## Configuracion local

Como `verify_jwt = false` queda en `supabase/config.toml`, para pruebas locales puedes usar:

```bash
supabase functions serve sincronizacion-you
```

Si usas secretos locales, puedes cargarlos con un archivo de entorno:

```bash
supabase functions serve sincronizacion-you --env-file supabase/functions/.env
```

## Cron

La funcion es compatible con ejecucion programada usando `POST` y el mismo secreto de migracion.

Ejemplo con `pg_cron` + `pg_net` como documentacion:

```sql
select cron.schedule(
  'sincronizacion-you-every-hour',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer MIGRATION_SECRET'
    ),
    body := '{"dryRun": false}'::jsonb
  );
  $$
);
```

Recomendacion de seguridad: no dejes `MIGRATION_SECRET` en texto plano dentro del job persistido. Si vas a programarlo desde SQL, guarda el secreto en un mecanismo seguro compatible con tu proyecto, por ejemplo Supabase Vault si ya lo tienes habilitado, y construye el header en tiempo de ejecucion.

Cambiar frecuencia:

- Ajusta la expresion cron, por ejemplo `*/15 * * * *` para cada 15 minutos.

Desactivar temporalmente:

- Usa `select cron.unschedule('sincronizacion-you-every-hour');`

Eliminarlo:

- Usa el mismo `cron.unschedule(...)` o borralo desde el dashboard si lo creaste alli.

Probar primero con `dryRun`:

- Cambia el body a `{"dryRun": true}` antes de pasar a ejecucion real.
- Para ejecuciones por lotes, envia tambien `limit`, por ejemplo `{"dryRun": true, "limit": 25}`.

## Cursor

La funcion usa la tabla existente `public.migration_cursor` como cursor operativo:

- Lee `next_offset` cuando no envias `offset`.
- Si el batch termina y aun hay mas registros, guarda el siguiente valor.
- Si llega al final, guarda `0` para reiniciar el siguiente ciclo.
- Un `dryRun` no modifica el cursor.
- Una ejecucion manual con `offset` explicito tampoco modifica el cursor persistido.

Supabase Cron desde dashboard:

- Crea un cron job HTTP que invoque `https://PROJECT_REF.supabase.co/functions/v1/sincronizacion-you` con metodo `POST`, header `Content-Type: application/json`, header de secreto y body JSON.

## Respuesta HTTP

Respuesta exitosa:

```json
{
  "success": true,
  "dryRun": false,
  "startedAt": "2026-07-24T13:10:35.000Z",
  "finishedAt": "2026-07-24T13:10:42.000Z",
  "durationMs": 7000,
  "filters": {
    "email": null,
    "cedula": null,
    "sharePointItemId": null,
    "limit": null,
    "roleId": 2
  },
  "summary": {
    "sharePointRecords": 100,
    "processed": 98,
    "created": 10,
    "updated": 15,
    "disabled": 3,
    "reactivated": 2,
    "repaired": 1,
    "unchanged": 60,
    "skipped": 5,
    "errors": 2
  },
  "partialErrors": true,
  "errors": []
}
```

## Fuentes verificadas

- Secrets por defecto de Edge Functions: https://supabase.com/docs/guides/functions/secrets
- Configuracion por funcion y `verify_jwt`: https://supabase.com/docs/guides/functions/function-configuration
- Detalle de `verify_jwt` en CLI config: https://supabase.com/docs/guides/local-development/cli/config

## Confirmacion

No se crearon migraciones SQL ni se modifico el esquema existente.
