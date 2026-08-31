# ping-backend-health

Edge Function para hacer ping al endpoint de salud del backend y evitar que Render lo duerma por inactividad.

## Endpoint objetivo

Por defecto consulta:

`https://uso-indebido-descuento-empleado-backend.onrender.com/api/health/`

Si luego quieres reutilizarla con otra URL, puedes definir `PING_HEALTH_TARGET_URL`.

## Comportamiento

- Acepta solo `GET` y `OPTIONS`.
- Hace `fetch` al endpoint configurado.
- Requiere `PING_HEALTH_SECRET` por seguridad.
- Debe tener `verify_jwt = false` en `supabase/config.toml`.
- Devuelve el `status` del upstream y una vista previa corta de la respuesta.

## Variables de entorno

Requerida:

- `PING_HEALTH_SECRET`

Opcional:

- `PING_HEALTH_TARGET_URL`

## Despliegue

```bash
supabase secrets set PING_HEALTH_SECRET="tu-secreto-seguro"
supabase functions deploy ping-backend-health
```

## Prueba manual

```bash
curl --request GET \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/ping-backend-health' \
  --header 'Authorization: Bearer PING_HEALTH_SECRET'
```

Tambien puedes usar:

```bash
curl --request GET \
  --url 'https://PROJECT_REF.supabase.co/functions/v1/ping-backend-health' \
  --header 'x-ping-secret: PING_HEALTH_SECRET'
```

## Cron cada 5 minutos

Ejemplo con `pg_cron` + `pg_net`:

```sql
select cron.schedule(
  'ping-backend-health-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/ping-backend-health',
    headers := jsonb_build_object(
      'Authorization', 'Bearer PING_HEALTH_SECRET'
    )
  );
  $$
);
```

Si prefieres, tambien puedes programar el cron directo contra el endpoint de Render, pero pasar por la Edge Function te deja centralizada la configuracion y la autenticacion.
