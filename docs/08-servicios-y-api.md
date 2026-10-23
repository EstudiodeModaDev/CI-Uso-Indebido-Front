# 08 · Servicios base e integraciones

El front habla con cuatro sistemas: la API NestJS, Supabase (Auth + base de datos), las Edge Functions de Supabase y la API corporativa de envío de correos.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| [services/supabase.service.ts](../src/services/supabase.service.ts) | Instancia única de `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)` |
| [services/api.service.ts](../src/services/api.service.ts) | Cliente HTTP para la API NestJS (`api.get`, `api.post`) |

## Cliente de la API (`api.service.ts`)

```ts
api.get<T>(path)          // GET  `${VITE_API_URL}${path}`
api.post<T>(path, body?)  // POST `${VITE_API_URL}${path}` con JSON.stringify(body)
```

Comportamiento de `request<T>()`:

1. Obtiene la sesión actual con `supabase.auth.getSession()`.
2. Envía `Content-Type: application/json` y, si hay sesión, `Authorization: Bearer <access_token>`. La API valida ese JWT de Supabase y resuelve el usuario y sus roles.
3. Si la respuesta no es `2xx`, intenta leer el cuerpo `{ message, error, statusCode }` (formato de NestJS) y lanza `Error` con `message` (si es un arreglo de validaciones, los une con espacios). Sin cuerpo legible: `"Error <status> al comunicarse con la API"`.
4. Si es `2xx`, devuelve `response.json()`. Todos los endpoints deben responder JSON.

### Endpoints de la API usados por el front

| Método y ruta | Body / query | Respuesta | Usado en |
| --- | --- | --- | --- |
| `POST /otp/generate` | `{ document }` | `{ success, expiresAt, maskedEmail }` | [03 · OTP](03-generacion-y-redencion-otp.md) |
| `POST /otp/validate` | `{ document, code }` | `{ valid, remainingAttempts, expiresAt }` | [03 · OTP](03-generacion-y-redencion-otp.md) |
| `POST /otp/redeem` | `{ document, code, purchaseValue, invoiceNumber }` | `CodigoOtp` | [03 · OTP](03-generacion-y-redencion-otp.md) |
| `POST /otp/history` | `{ document, email }` | `HistorialCodigo[]` | [04 · Historial](04-historial-y-reportes.md) |
| `POST /otp/history/admin` | `{ document?, generationStoreId?, redemptionStoreId?, page, pageSize }` | `{ items, total, page, pageSize }` | [07 · Tablero](07-admin-tablero-codigos.md) |
| `GET /stores` | — | `Tienda[]` | [07 · Tablero](07-admin-tablero-codigos.md) |
| `GET /invoice` | `?cedula=&factura=` | `{ data: invoice[] }` | [07 · Tablero](07-admin-tablero-codigos.md) |
| `POST /otp/generate-password` | `{ email }` | `{ success, message }` | [02 · Autenticación](02-autenticacion-y-roles.md) |
| `POST /otp/validate-password` | `{ email, code }` | `{ valid, tokenHash }` | [02 · Autenticación](02-autenticacion-y-roles.md) |

La especificación completa de la API vive en el proyecto del backend (`CI-Back-Compras-y-descuentos/documents/openapi.yaml`).

## Supabase desde el navegador

El cliente usa la clave pública, así que **todas** las operaciones quedan sujetas a las políticas RLS de la base de datos.

### Supabase Auth

| Operación | Dónde |
| --- | --- |
| `getSession`, `onAuthStateChange` | `AuthProvider` |
| `signInWithPassword`, `signOut` | `AuthProvider` |
| `updateUser({ password })` | `AuthProvider.changePassword`, `restablecerPasswordRequest` |
| `verifyOtp({ token_hash, type: 'recovery' })` | `restablecerPasswordRequest` |

### Tablas consultadas directamente

| Tabla | Operación | Dónde |
| --- | --- | --- |
| `USUARIOS` (+ `PERSONAS`) | `select` por `auth_user_id` | `AuthProvider.loadProfile` |
| `USUARIOS` | `update requiere_cambio_password, fecha_actualizacion` | `changePassword`, `restablecerPasswordRequest` |
| `USUARIOS_ROLES` (+ `ROLES`) | `select` roles activos | `AuthProvider.loadProfile` |
| `PERSONAS` | `select` por `numero_documento` | [Otp.tsx](../src/components/Otp/Otp.tsx) |
| `USUARIOS_ROLES` (+ `ROLES`, `USUARIOS`, `PERSONAS`) | `select` para exportar | `fetchPersonasByRol` |
| `REPORTES_USO_INDEBIDO` | `insert` | `crearReporteRequest` |

El modelo de datos se describe en [09-modelos-de-datos.md](09-modelos-de-datos.md).

### Edge Functions invocadas desde el front

| Función | Invocación | Documentación |
| --- | --- | --- |
| `bulk-create-users` | `supabase.functions.invoke('bulk-create-users', { body: { rows } })` | [supabase/bulk-create-users.md](supabase/bulk-create-users.md) |

Las demás funciones (`sincronizacion-you`, `migrate-sharepoint-users`, `keep-db-awake`, `ping-backend-health`) se ejecutan por cron o manualmente; el front no las llama. Ver [supabase/README.md](supabase/README.md).

## API de envío de correos

[useCrearReporte.ts](../src/Funcionalidades/reportes/hooks/useCrearReporte.ts) hace `POST https://api-envio-correos-bchfaebqdhfcbdgw.canadacentral-01.azurewebsites.net/mail/send` con un `GraphMailPayload` ([models/mail.ts](../src/models/mail.ts)):

```json
{
  "senderMail": "alert@estudiodemoda.com.co",
  "message": {
    "subject": "…",
    "body": { "contentType": "HTML", "content": "<html>…</html>" },
    "toRecipients": [{ "emailAddress": { "address": "…" } }],
    "ccRecipients": [],
    "attachments": []
  },
  "saveToSentItems": true
}
```

Respuesta esperada: `{ ok, message, graph: { id, internetMessageId, … } }`. La URL está fija en el código (no en una variable de entorno) y la petición no lleva token de autenticación.
