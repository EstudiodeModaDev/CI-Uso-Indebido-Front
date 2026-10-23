# Edge Function: `bulk-create-users`

Crea o actualiza usuarios en Supabase Auth y en las tablas `PERSONAS`, `USUARIOS` y `USUARIOS_ROLES` a partir de las filas del Excel que sube control interno.

- **Código:** [supabase/functions/bulk-create-users/index.ts](../../supabase/functions/bulk-create-users/index.ts)
- **La invoca:** [usuarios.service.ts](../../src/Funcionalidades/usuarios/services/usuarios.service.ts) → `bulkCreateUsersRequest` (pantalla [06 · Carga de usuarios](../06-admin-carga-usuarios.md))
- **Método:** `POST` (y `OPTIONS` para CORS)

## Seguridad

1. Se despliega **con** verificación de JWT: el gateway de Supabase rechaza cualquier petición sin un JWT válido.
2. Dentro de la función, `auth.getUser(token)` valida la sesión → `401 Sesión inválida o expirada`.
3. `callerHasControlInternoRole` busca el `USUARIOS` del llamante y comprueba que tenga el rol `CONTROL_INTERNO` activo en `USUARIOS_ROLES` → si no, `403 No tienes permisos para crear usuarios`.

## Request

```json
{
  "rows": [
    {
      "tipo_documento": "CC",
      "numero_documento": "123456789",
      "nombres": "Ana",
      "apellidos": "Pérez",
      "correo": "ana.perez@ejemplo.com",
      "telefono": "3001234567",
      "estado": "ACTIVO",
      "tipo_persona": "PROVEEDOR",
      "empresa_pertenece": "Empresa S.A.S."
    }
  ]
}
```

| Regla | Respuesta si falla |
| --- | --- |
| Body JSON válido | `400` |
| `rows` es un arreglo no vacío | `400 Falta "rows"` |
| Máximo `MAX_ROWS = 900` filas | `400 Máximo 900 filas por carga…` |

## Procesamiento

Antes del bucle, en paralelo:

- Indexa por correo todos los usuarios de Auth (`auth.admin.listUsers`, páginas de 200).
- Obtiene el `id` del rol fijo `SOCIO` en `ROLES` (si no existe, `500`).

Luego procesa cada fila **en secuencia**; un error en una fila no detiene las demás.

1. **Normaliza:** recorta todos los campos; el correo pasa a minúsculas; `estado` a mayúsculas (por defecto `ACTIVO`).
2. **Valida:** correo y número de documento obligatorios.
3. **Auth:** si el correo no existe en Auth, lo crea con `password = numero_documento` y `email_confirm: true`.
4. **Tablas:**
   - Si ya existe `USUARIOS` con ese `auth_user_id`: actualiza su `PERSONAS` y su `USUARIOS` (`correo`, `estado`, `fecha_actualizacion`) → `status: "updated"`.
   - Si no existe: inserta `PERSONAS` y luego `USUARIOS` con `requiere_cambio_password = true` → `status: "created"`.
   - En `PERSONAS` siempre escribe `tipo_persona = "SOCIO COMERCIAL"` (no usa el valor del Excel).
5. **Rol:** solo si el usuario no tiene **ningún** rol activo, inserta `USUARIOS_ROLES` con el rol `SOCIO`. Si ya tiene otro (`TIENDA`, `EMPLEADO`, `CONTROL_INTERNO`), no se toca.

El número de fila reportado es `índice + 2` (la fila 1 del Excel es el encabezado).

## Respuesta

```json
{
  "total": 3,
  "creados": 1,
  "actualizados": 1,
  "errores": 1,
  "detalle": [
    { "fila": 2, "correo": "ana@ejemplo.com", "status": "created", "message": "Usuario creado en Auth y en las tablas de la app" },
    { "fila": 3, "correo": "luis@ejemplo.com", "status": "updated", "message": "Datos actualizados" },
    { "fila": 4, "correo": "(sin correo)", "status": "error", "message": "Falta el correo" }
  ]
}
```

Mensajes posibles por fila:

| `status` | `message` |
| --- | --- |
| `created` | "Usuario creado en Auth y en las tablas de la app" |
| `created` | "El usuario ya existía en Auth; se crearon sus filas en PERSONAS/USUARIOS" |
| `updated` | "Datos actualizados" |
| `updated` | "Datos actualizados; no tenía rol activo, se le asignó SOCIO" |
| `error` | Motivo (falta correo/documento, fallo de Auth o de una tabla) |

## Variables de entorno

| Variable | Obligatoria | Notas |
| --- | --- | --- |
| `SUPABASE_URL` | Sí | Automática |
| `SB_STATIC_SECRET_KEY` / `SUPABASE_SECRET_KEYS` / `SUPABASE_SERVICE_ROLE_KEY` | Una de ellas | Se usa la primera que exista, en ese orden |

## Despliegue

```bash
supabase functions deploy bulk-create-users
```

Sin `--no-verify-jwt`.

## Diferencias con el README de la función

El [README de la función](../../supabase/functions/bulk-create-users/README.md) describe una versión anterior: asignaba el rol según `tipo_persona` (`TIENDA`/`CONTROL_INTERNO`) y aceptaba como máximo 300 filas. El código actual asigna siempre `SOCIO` y acepta hasta 900 filas. Esta página documenta el comportamiento actual del código.
