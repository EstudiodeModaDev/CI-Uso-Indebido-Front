# 09 · Modelos de datos

Dos niveles: los **tipos TypeScript** del front ([src/models](../src/models)) y las **tablas de Supabase** que el front y las Edge Functions leen o escriben.

## Tipos TypeScript (`src/models`)

| Archivo | Tipos | Uso |
| --- | --- | --- |
| [auth.ts](../src/models/auth.ts) | `UserProfile`, `UserRole`, `PersonData`, constantes `ROLE_*`, `GeneratePasswordOtpResponse`, `ValidatePasswordOtpResponse` | Sesión, roles, recuperación de contraseña |
| [code.ts](../src/models/code.ts) | `CodigoOtp`, `generateOtpResponse`, `validateOtpResponse`, `HistorialCodigo`, `HistorialCodigoAdmin`, `ItemVendido`, `HistorialAdminFiltros`, `HistorialAdminPagina`, `Tienda`, `otpRecord` | OTP, historial y tablero |
| [invoice.ts](../src/models/invoice.ts) | `invoice` | Respuesta de `GET /invoice` (campos del POS/ERP en PascalCase) |
| [bulkUsers.ts](../src/models/bulkUsers.ts) | `ExcelUserRow`, `BulkCreateRowStatus`, `BulkCreateRowResult`, `BulkCreateSummary` | Carga masiva |
| [personas.ts](../src/models/personas.ts) | `PersonaExportRow` | Exportación de usuarios |
| [reporte.ts](../src/models/reporte.ts) | `ReporteCodigo`, `CrearReportePayload` | Reporte de uso indebido |
| [mail.ts](../src/models/mail.ts) | `GraphMailPayload`, `ApiResponse` | API de correos |

### Estados de un código OTP

Según el contexto, el mismo código se representa con distintos conjuntos de estados:

| Tipo | Estados | Dónde |
| --- | --- | --- |
| `EstadoCodigoOtp` | `ACTIVO`, `USADO`, `EXPIRADO` | Respuesta de `/otp/redeem` |
| `EstadoHistorialCodigo` | `REDIMIDO`, `EXPIRADO` | Historial del usuario |
| `EstadoCodigoAdmin` | `PENDIENTE`, `REDIMIDO`, `EXPIRADO`, `ANULADO`, `BLOQUEADO` | Tablero de control interno |

## Tablas de Supabase

Las tablas usan nombres en MAYÚSCULAS, por lo que en SQL deben ir siempre entre comillas dobles (`public."PERSONAS"`).

Esta sección cubre las tablas que toca el front. El modelo completo de la base, incluidas las tablas de la API (`CODIGOS_OTP`, `TIENDAS`, `ENVIOS_CORREO`…), con diagrama entidad-relación, está en [supabase/modelo-de-datos.md](supabase/modelo-de-datos.md).

> **Importante:** las migraciones de [supabase/migrations](../supabase/migrations) **no** reflejan el esquema real (ver [supabase/README.md](supabase/README.md#migraciones)). Las columnas de esta sección se deducen del código que las usa.

### `PERSONAS`

Datos personales de cualquier persona (beneficiario, tienda, administrador).

| Columna | Notas |
| --- | --- |
| `id` | PK autogenerada (se trata como `string` en el front) |
| `tipo_documento` | Ej. `CC` |
| `numero_documento` | Cédula; clave de búsqueda en `/otp` y contraseña inicial |
| `nombres`, `apellidos` | |
| `correo` | Correo personal (al que llega el OTP) |
| `telefono` | |
| `estado` | `ACTIVO` / `INACTIVO` |
| `tipo_persona` | Lo escribe `bulk-create-users` (`"SOCIO COMERCIAL"`) |
| `empresa_pertenece` | Empresa del socio/proveedor |
| `fecha_actualizacion`, `created_at` | |

### `USUARIOS`

Cuenta de acceso a la aplicación, enlazada a Supabase Auth.

| Columna | Notas |
| --- | --- |
| `id` | PK numérica |
| `id_persona` | FK → `PERSONAS.id` (relación `usuarios_id_persona_fkey`) |
| `auth_user_id` | `auth.users.id` |
| `correo` | Correo de login |
| `estado` | `ACTIVO` / `INACTIVO` / `BLOQUEADO` |
| `requiere_cambio_password` | `true` fuerza el cambio de contraseña al entrar |
| `intentos_fallidos`, `ultimo_ingreso` | |
| `fecha_creacion`, `fecha_actualizacion` | |

### `ROLES` y `USUARIOS_ROLES`

| Tabla | Columnas |
| --- | --- |
| `ROLES` | `id`, `nombre` (`TIENDA`, `CONTROL_INTERNO`, `EMPLEADO`, `SOCIO`) |
| `USUARIOS_ROLES` | `id_usuario_rol` (PK), `id_usuario` → `USUARIOS.id`, `id_rol` → `ROLES.id` (relación `usuarios_roles_id_rol_fkey`), `estado` (`ACTIVO`/`INACTIVO`), `fecha_asignacion` |

Solo cuentan los roles con `estado = 'ACTIVO'`. Un usuario puede tener varios.

### `REPORTES_USO_INDEBIDO`

Insertada desde el front al reportar un código.

| Columna | Notas |
| --- | --- |
| `id` | PK |
| `persona_id` | Persona que reporta |
| `codigo_otp_id` | Código reportado |
| `tipo_reporte` | Hoy siempre `"Uso indebido"` |
| `descripcion` | Razón escrita por el usuario |
| `fecha_reporte` | |

### `LOG`

Bitácora usada por las Edge Functions de sincronización y leída por `keep-db-awake`.

| Columna | Notas |
| --- | --- |
| `usuario` | `USUARIOS.id` afectado o `null` |
| `accion` | Ej. `SINCRONIZACION_INICIADA`, `USUARIO_CREADO`, `ERROR_VALIDACION` |
| `entidad` | Ej. `SINCRONIZACION_YOU`, `SHAREPOINT`, `AUTH_USERS` |
| `resultado` | `EXITOSO`, `ERROR`, `OMITIDO`, `SIN_CAMBIOS`, `SIMULADO` |
| `mensaje` | Texto o JSON serializado |

### `migration_cursor`

Una sola fila (`id = 1`) con `next_offset` y `updated_at`. Guarda por dónde va el recorrido por lotes de la lista de SharePoint. La comparten `sincronizacion-you` y `migrate-sharepoint-users`.

### Tablas de la API (no las toca el front)

Los códigos OTP, las tiendas y las facturas se gestionan a través de la API NestJS. Sus tablas se describen en [supabase/modelo-de-datos.md](supabase/modelo-de-datos.md#operación-de-descuentos).
