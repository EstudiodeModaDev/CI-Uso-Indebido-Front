# Edge Function: `keep-db-awake`

Hace una lectura mínima en la base de datos para generar actividad y evitar que el proyecto de Supabase se pause por inactividad.

- **Código:** [supabase/functions/keep-db-awake/index.ts](../../supabase/functions/keep-db-awake/index.ts)
- **La invoca:** cron (sugerido cada 15 minutos). El front no la usa.
- **Método:** `GET` (y `OPTIONS`)
- **`verify_jwt`:** `false`

## Autorización

`Authorization: Bearer <KEEP_AWAKE_SECRET>` **o** `x-keep-awake-secret: <KEEP_AWAKE_SECRET>`. Si no coincide → `401`.

## Qué hace

1. Crea un cliente de Supabase con `SUPABASE_SERVICE_ROLE_KEY`.
2. Ejecuta `select * from "LOG" limit 1`.
3. Devuelve el resultado.

## Respuestas

```json
{ "success": true, "message": "Base de datos consultada correctamente",
  "startedAt": "2026-10-23T12:00:00.000Z", "checkedTable": "LOG", "rowsRead": 1 }
```

| HTTP | Causa |
| --- | --- |
| 200 | Consulta correcta |
| 401 | Secreto incorrecto |
| 405 | Método distinto de `GET` |
| 500 | Falta una variable de entorno o falló la consulta |

## Variables de entorno

| Variable | Obligatoria |
| --- | --- |
| `SUPABASE_URL` | Sí (automática) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí (automática) |
| `KEEP_AWAKE_SECRET` | Sí |

## Despliegue y cron

```bash
supabase secrets set KEEP_AWAKE_SECRET="<secreto>"
supabase functions deploy keep-db-awake
```

```sql
select cron.schedule(
  'keep-db-awake-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/keep-db-awake',
    headers := jsonb_build_object('Authorization', 'Bearer <KEEP_AWAKE_SECRET>')
  );
  $$
);
```
