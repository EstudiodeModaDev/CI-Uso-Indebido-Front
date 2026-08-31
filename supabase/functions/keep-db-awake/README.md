# keep-db-awake

Edge Function para mantener activa la base de datos haciendo una lectura liviana sobre la tabla `LOG`.

## Comportamiento

- Acepta solo `GET` y `OPTIONS`.
- Consulta `LOG` con `limit(1)` para generar actividad en la base.
- Usa `SUPABASE_SERVICE_ROLE_KEY` para evitar depender de politicas RLS del cliente.
- Requiere `KEEP_AWAKE_SECRET` por seguridad.
- Debe tener `verify_jwt = false` en `supabase/config.toml`.

## Variables de entorno requeridas

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KEEP_AWAKE_SECRET`

## Despliegue

```bash
supabase secrets set KEEP_AWAKE_SECRET="tu-secreto-seguro"
supabase functions deploy keep-db-awake
```

## Prueba manual

```bash
curl --request GET \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/keep-db-awake' \
  --header 'Authorization: Bearer KEEP_AWAKE_SECRET'
```

Tambien puedes usar:

```bash
curl --request GET \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/keep-db-awake' \
  --header 'x-keep-awake-secret: KEEP_AWAKE_SECRET'
```

## Cron

Ejemplo con `pg_cron` + `pg_net`:

```sql
select cron.schedule(
  'keep-db-awake-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/keep-db-awake',
    headers := jsonb_build_object(
      'Authorization', 'Bearer KEEP_AWAKE_SECRET'
    )
  );
  $$
);
```

Si prefieres, tambien puedes programarla desde el dashboard de Supabase o con un servicio externo tipo Uptime Kuma, GitHub Actions o cron del servidor.
