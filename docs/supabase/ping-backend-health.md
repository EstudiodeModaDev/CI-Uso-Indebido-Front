# Edge Function: `ping-backend-health`

Llama al endpoint de salud del backend para que el servicio de hosting no lo suspenda por inactividad.

- **Código:** [supabase/functions/ping-backend-health/index.ts](../../supabase/functions/ping-backend-health/index.ts)
- **La invoca:** cron (sugerido cada 5 minutos). El front no la usa.
- **Método:** `GET` (y `OPTIONS`)
- **`verify_jwt`:** `false`

## Autorización

`Authorization: Bearer <PING_HEALTH_SECRET>` **o** `x-ping-secret: <PING_HEALTH_SECRET>`. Si no coincide → `401`.

## Qué hace

1. Hace `GET` a `PING_HEALTH_TARGET_URL`. Si no está definida, usa la URL por defecto del código: `https://uso-indebido-descuento-empleado-backend.onrender.com/api/health/`.
2. Devuelve el estado del servicio consultado y los primeros 500 caracteres de su respuesta.

> El backend se despliega hoy en Azure (ver el workflow del proyecto del backend). Si ya no corre en Render, define `PING_HEALTH_TARGET_URL` con la URL vigente; si no, el ping apunta a un servicio que ya no se usa.

## Respuestas

```json
{ "success": true, "startedAt": "…", "targetUrl": "https://…/api/health/",
  "upstreamStatus": 200, "upstreamOk": true, "responsePreview": "{\"status\":\"ok\"}" }
```

| HTTP | Causa |
| --- | --- |
| 200 | El backend respondió `2xx` |
| 502 | El backend respondió con error |
| 401 | Secreto incorrecto |
| 405 | Método distinto de `GET` |
| 500 | Falta `PING_HEALTH_SECRET` o falló la petición (DNS, red) |

## Variables de entorno

| Variable | Obligatoria |
| --- | --- |
| `PING_HEALTH_SECRET` | Sí |
| `PING_HEALTH_TARGET_URL` | No |

## Despliegue y cron

```bash
supabase secrets set PING_HEALTH_SECRET="<secreto>" PING_HEALTH_TARGET_URL="https://<backend>/api/health/"
supabase functions deploy ping-backend-health
```

```sql
select cron.schedule(
  'ping-backend-health-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/ping-backend-health',
    headers := jsonb_build_object('Authorization', 'Bearer <PING_HEALTH_SECRET>')
  );
  $$
);
```
