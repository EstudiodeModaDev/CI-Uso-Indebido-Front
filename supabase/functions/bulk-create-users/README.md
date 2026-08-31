# bulk-create-users

Edge Function que recibe las filas parseadas de un Excel (subido desde
`src/components/Admin/CargaUsuarios.tsx`) y crea/actualiza usuarios en Supabase Auth +
las tablas `"PERSONAS"`, `"USUARIOS"` y `"USUARIOS_ROLES"`.

## Diferencia con migrate-sharepoint-users

Esa función se protege con un secreto compartido (`x-migration-secret`) porque la invoca
un cron sin sesión de usuario. Esta función la invoca el frontend con la sesión de un
usuario ya autenticado (`supabase.functions.invoke`), así que:

- Se despliega **con** verificación de JWT (sin `--no-verify-jwt`): Supabase rechaza de
  entrada cualquier solicitud sin un JWT válido de Auth.
- Además, dentro de `index.ts` se verifica que ese usuario tenga el rol `CONTROL_INTERNO`
  activo en `"USUARIOS_ROLES"` (mismo patrón de consulta que usa
  `src/contexts/AuthContext.tsx` en el frontend), para que solo administradores puedan
  crear usuarios masivamente.

## Body esperado

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
      "tipo_persona": "TIENDA"
    }
  ]
}
```

- `tipo_persona` debe resolver a un rol existente en la tabla `"ROLES"` — hoy `TIENDA` o
  `CONTROL_INTERNO` (ver `VALID_ROLES` en `index.ts` y `ROLE_TIENDAS`/`ROLE_CONTROL_INTERNO`
  en `src/models/auth.ts`).
- `numero_documento` se usa como contraseña inicial del usuario nuevo en Auth
  (`email_confirm: true`), y su fila en `"USUARIOS"` queda con
  `requiere_cambio_password = true` para forzar el cambio en el primer login (pantalla
  ya existente en `src/components/Cuenta/CambiarPasswordModal.tsx`).
- Máximo `MAX_ROWS` (300) filas por invocación — para archivos más grandes, dividir en
  varias cargas.

## Comportamiento por fila

1. Si no existe un usuario de Auth con ese correo, se crea (`status: "created"`).
2. Si ya existe una fila en `"USUARIOS"` para ese `auth_user_id`, se actualizan sus datos
   y los de su `"PERSONAS"` asociada (`status: "updated"`) — esto hace que volver a subir
   el mismo Excel sea seguro (idempotente), útil para corregir datos o repetir una carga
   parcial.
3. Si no existía la fila en `"USUARIOS"` (usuario nuevo, o usuario de Auth preexistente
   sin datos en la app), se inserta `"PERSONAS"` y `"USUARIOS"` desde cero.
4. Se asegura la fila en `"USUARIOS_ROLES"` para el rol de `tipo_persona` (sin duplicarla
   si ya existe).

Un error en una fila no aborta las demás: cada una se reporta con su propio
`status`/`message` en la respuesta.

## Respuesta

```json
{
  "total": 10,
  "creados": 7,
  "actualizados": 2,
  "errores": 1,
  "detalle": [
    { "fila": 2, "correo": "ana.perez@ejemplo.com", "status": "created", "message": "..." }
  ]
}
```

## Deploy

```bash
supabase functions deploy bulk-create-users
```

Reutiliza los mismos secrets ya configurados para el proyecto (`SB_STATIC_SECRET_KEY` /
`SUPABASE_SECRET_KEYS` / `SUPABASE_SERVICE_ROLE_KEY`, ver el README de
`migrate-sharepoint-users`) — no requiere secrets propios adicionales.

## Supuesto sobre el esquema

Esta función asume el esquema real ya usado por el frontend (`AuthContext.tsx`), que
difiere del que describe la migración
`supabase/migrations/20260723000000_migration_users_tables.sql` (esa migración quedó
desactualizada frente a cambios hechos directamente en la base):

- `"PERSONAS"`: `id` (PK autogenerado), `tipo_documento`, `numero_documento`, `nombres`,
  `apellidos`, `correo`, `telefono`, `estado`.
- `"USUARIOS"`: `id` (PK autogenerado), `id_persona` (FK a `"PERSONAS".id`), `correo`,
  `estado`, `auth_user_id`, `requiere_cambio_password`, `fecha_actualizacion`.
- `"USUARIOS_ROLES"`: `id_usuario` (FK a `"USUARIOS".id`), `id_rol` (FK a `"ROLES".id`),
  `estado`.
- `"ROLES"`: `id`, `nombre`.

Si alguno de estos nombres de columna cambia, ajustar `index.ts` (no hay un `config.ts`
separado como en `migrate-sharepoint-users` porque aquí el mapeo es fijo, no viene de un
origen externo configurable).
