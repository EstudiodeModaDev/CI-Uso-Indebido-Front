# migrate-sharepoint-users

Edge Function que migra usuarios desde una lista de SharePoint (leída vía Microsoft
Graph) hacia Supabase Auth + las tablas `"PERSONAS"` y `"USUARIOS"`.

## Archivos

- `index.ts` — orquestación: auth por secreto compartido, batching, creación/actualización
  de usuarios, upsert en las tablas destino, logging.
- `graph.ts` — cliente Graph: token por client credentials + lectura paginada de items.
- `config.ts` — **único lugar** donde se define el mapeo de campos (SharePoint -> columnas).
  Ajustar aquí los nombres internos de columna de tu lista y los nombres de tabla. Cada
  entrada de `fieldMap` puede ser un string (campo copiado tal cual) o una función
  `(item) => valor` para combinar/transformar varios campos de origen (ver el ejemplo de
  `nombres`/`apellidos` en `tables.personas.fieldMap`).
- `deno.json` — opciones del compilador de Deno para esta función.
- `../../migrations/20260723000000_migration_users_tables.sql` — tablas `"PERSONAS"`,
  `"USUARIOS"`, `migration_logs` y `migration_cursor`.

## 1. Antes de desplegar

Editar `config.ts`:

- `sharepoint.emailField`, `sharepoint.cedulaField`, `sharepoint.activeField`: nombres
  **internos** de columna de la lista (no el display name). Se ven en Graph Explorer con
  `GET /sites/{siteId}/lists/{listId}/columns` o inspeccionando el JSON de un item.
- `tables.personas.fieldMap` / `tables.usuarios.fieldMap`: columna destino ->
  campo origen de SharePoint. Agregar/quitar pares según lo que necesites persistir.
- Si prefieres otros nombres de tabla, cambia `tables.personas.table` /
  `tables.usuarios.table` y crea las tablas correspondientes en una migración. Si el
  nombre tiene mayúsculas (como `"PERSONAS"`/`"USUARIOS"`), la tabla debe crearse y
  referenciarse siempre entre comillas dobles en SQL (`create table public."PERSONAS"`),
  porque Postgres pliega a minúsculas los identificadores sin comillas.

Aplicar la migración SQL:

```bash
supabase db push
```

## 2. Secrets de la función

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya existen automáticamente en el entorno
de toda Edge Function desplegada en Supabase — **no** hace falta declararlos.

Configurar el resto:

```bash
supabase secrets set \
  MS_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  MS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  MS_CLIENT_SECRET='valor-del-client-secret' \
  MS_SITE_ID='contoso.sharepoint.com,guid-site,guid-web' \
  MS_LIST_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  MIGRATION_SECRET='un-secreto-largo-y-aleatorio'
```

El App Registration de Microsoft Entra ID usado en `MS_CLIENT_ID`/`MS_CLIENT_SECRET` debe
tener el permiso de aplicación **`Sites.Read.All`** (o `Sites.Selected` restringido a ese
sitio) en Microsoft Graph, con consentimiento de administrador otorgado.

`MIGRATION_SECRET` es el valor que protege la invocación manual — genera uno propio, por
ejemplo con `openssl rand -hex 32`.

## 3. Deploy

```bash
supabase functions deploy migrate-sharepoint-users --no-verify-jwt
```

`--no-verify-jwt` es necesario porque la función no se llama con un JWT de usuario de
Supabase: la protege el header `x-migration-secret` verificado dentro de `index.ts`. Sin
este flag, Supabase rechazaría cron/curl que no manden un JWT válido antes de que el
código de la función siquiera se ejecute.

## 4a. Invocación manual (HTTP)

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/migrate-sharepoint-users' \
  -H 'Content-Type: application/json' \
  -H 'x-migration-secret: un-secreto-largo-y-aleatorio' \
  -d '{"limit": 500}'
```

Body opcional:

- `limit` (number): cuántos items de SharePoint procesar en esta invocación. Default:
  `CONFIG.batch.defaultLimit` (200).
- `offset` (number): desde qué índice de la lista empezar. Si se omite, la función usa
  y actualiza el cursor persistido en `migration_cursor` (ver más abajo), así que en
  invocaciones manuales sin `offset` también avanza el barrido incremental automático.

Respuesta: JSON con `total procesados`, `creados`, `existentes`, `desactivados`,
`reactivados`, `errores` (con email + mensaje de cada uno), y `done`/`nextOffset` para
saber si falta continuar.

## 4b. Invocación programada (cron)

### Opción recomendada: pg_cron + pg_net

Habilitar las extensiones (una vez):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Programar la llamada (ejemplo: cada 5 minutos, procesando 200 items por corrida — el
cursor en `migration_cursor` hace que cada tick continúe donde quedó el anterior y
reinicie el barrido cuando termina toda la lista):

```sql
select cron.schedule(
  'migrate-sharepoint-users',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/migrate-sharepoint-users',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-migration-secret', '<mismo valor de MIGRATION_SECRET>'
    ),
    body := jsonb_build_object('limit', 200)
  ) as request_id;
  $$
);
```

Para no dejar el secreto en texto plano dentro del job (`cron.job` es visible para roles
con privilegios sobre `pg_cron`), guárdalo en Supabase Vault y referencia el valor
descifrado en el mismo bloque SQL:

```sql
select vault.create_secret('<mismo valor de MIGRATION_SECRET>', 'migration_secret');

-- luego, dentro del cron.schedule:
headers := jsonb_build_object(
  'Content-Type', 'application/json',
  'x-migration-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'migration_secret')
)
```

Para desprogramar: `select cron.unschedule('migrate-sharepoint-users');`

### Opción alternativa: Cron nativo del Dashboard de Supabase

En el Dashboard del proyecto, en **Integrations > Cron Jobs**, se puede crear un job que
invoque directamente esta Edge Function con un schedule tipo cron, sin escribir SQL a
mano. Internamente usa la misma infraestructura de pg_cron + pg_net, así que aplica el
mismo header `x-migration-secret` y el mismo body opcional `{"limit": N}`.

## 5. Listas grandes: cómo se dividió el trabajo

- La función descarga **toda** la lista de SharePoint en cada invocación (la paginación
  de Graph es rápida); lo costoso es el trabajo por usuario contra Supabase Auth.
- Por eso el procesamiento pesado se hace en **batches** controlados por `limit`/`offset`,
  y además hay un corte por tiempo (`CONFIG.batch.maxRuntimeMs`, default 50s) para no
  acercarse al límite real de ejecución de la Edge Function.
- El progreso se persiste en la tabla `migration_cursor` (una sola fila) cuando no se pasa
  `offset` explícito. Así, programando el cron cada pocos minutos con un `limit` moderado,
  la migración completa se hace incrementalmente sin reprocesar toda la lista en una sola
  invocación, y se reinicia sola al llegar al final (para detectar altas/bajas nuevas).
- Si la lista de SharePoint llega a tener **decenas de miles de items**, este enfoque de
  "traer todo y recorrer con cursor" deja de ser ideal (cada invocación paga el costo de
  volver a bajar y volver a indexar todos los usuarios de Auth). En ese caso conviene
  pasar a un patrón de cola: una función liviana que sincroniza los items de SharePoint a
  una tabla de staging, y un worker (otra función, o `pgmq` + `pg_cron`) que consume esa
  cola en lotes pequeños. No fue necesario para el volumen esperado aquí, pero es el
  siguiente paso natural si la lista crece mucho.

## 6. Logs

Cada intento por usuario queda registrado en `migration_logs` (`run_id`, `email`,
`status`, `message`, `created_at`), además de `console.log`/`console.error` visibles en:

```bash
supabase functions logs migrate-sharepoint-users
```
