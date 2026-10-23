# 06 · Administración: carga y exportación de usuarios

Pantalla de control interno con dos tarjetas: **Carga de usuarios** desde Excel y **Exportar usuarios** a Excel.

- **Ruta:** `/admin/usuarios`
- **Acceso:** requiere rol `CONTROL_INTERNO`
- Se carga con `React.lazy` (trae la librería `xlsx`).

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| [components/Admin/CargaUsuarios.tsx](../src/components/Admin/CargaUsuarios.tsx) | Pantalla: selector de archivo, vista previa, resumen del resultado y exportación |
| [Funcionalidades/usuarios/hooks/useCargaUsuarios.ts](../src/Funcionalidades/usuarios/hooks/useCargaUsuarios.ts) | Estado de la carga: filas leídas, archivo, `isParsing`, `isUploading`, resumen |
| [Funcionalidades/usuarios/hooks/useExportarUsuarios.ts](../src/Funcionalidades/usuarios/hooks/useExportarUsuarios.ts) | Filtro por rol y exportación |
| [Funcionalidades/usuarios/services/usuarios.service.ts](../src/Funcionalidades/usuarios/services/usuarios.service.ts) | Parseo del Excel, invocación de la Edge Function, consulta y generación del Excel de exportación |
| [models/bulkUsers.ts](../src/models/bulkUsers.ts) | `ExcelUserRow`, `BulkCreateSummary`, `BulkCreateRowResult` |
| [models/personas.ts](../src/models/personas.ts) | `PersonaExportRow` |
| Edge Function [bulk-create-users](supabase/bulk-create-users.md) | Crea/actualiza los usuarios en el servidor |

## Carga masiva

### Paso 1 · Leer el archivo

`parseExcelFile(file)` (todo en el navegador, sin subir el archivo):

1. Lee **solo la primera hoja** con SheetJS.
2. Convierte cada fila a objeto (`sheet_to_json` con `defval: ''`).
3. Normaliza cada encabezado (quita tildes, pasa a minúsculas y elimina todo lo que no sea letra o número) y lo traduce con `COLUMN_ALIASES`.
4. Descarta las filas completamente vacías.

Encabezados aceptados (después de normalizar):

| Campo destino | Encabezados válidos en el Excel |
| --- | --- |
| `tipo_documento` | Tipo documento |
| `numero_documento` | Número documento, N° documento, Documento, Cédula |
| `nombres` | Nombres, Nombre |
| `apellidos` | Apellidos, Apellido |
| `correo` | Correo, Email, Correo electrónico |
| `telefono` | Teléfono, Celular |
| `estado` | Estado |
| `tipo_persona` | Tipo persona, Tipo de persona, Rol |
| `empresa_pertenece` | Empresa pertenece, Empresa |

Las columnas no reconocidas se ignoran. Todos los valores se convierten a texto y se recortan.

### Paso 2 · Vista previa

Se muestra una tabla con documento, nombres, apellidos, correo, teléfono y empresa, junto al número de filas detectadas. **Cambiar archivo** limpia todo.

### Paso 3 · Crear usuarios

**Crear N usuario(s)** llama a `bulkCreateUsersRequest(rows)`, que invoca la Edge Function con el JWT de la sesión:

```ts
supabase.functions.invoke('bulk-create-users', { body: { rows } })
```

Si la función responde con error, se intenta leer `body.error` de la respuesta para mostrar el mensaje real (por ejemplo, "No tienes permisos para crear usuarios" o el límite de filas).

### Paso 4 · Resultado

La función devuelve un `BulkCreateSummary`:

```json
{ "total": 10, "creados": 7, "actualizados": 2, "errores": 1,
  "detalle": [{ "fila": 2, "correo": "ana@ejemplo.com", "status": "created", "message": "..." }] }
```

Se muestran tres chips (creados, actualizados, con error) y una tabla por fila con su resultado. `fila` corresponde a la fila real del Excel (la 1 es el encabezado).

Reglas aplicadas en el servidor (resumen; detalle en [bulk-create-users.md](supabase/bulk-create-users.md)):

- Contraseña inicial = número de documento, con cambio obligatorio en el primer ingreso.
- El rol asignado es siempre `SOCIO`, y solo si el usuario no tiene ya un rol activo.
- Volver a subir el mismo archivo es seguro: los existentes se actualizan.
- Máximo 900 filas por carga.

## Exportación de usuarios

1. Se elige un rol en el selector (`Todos los roles`, `Tienda`, `Empleado`, `Socio`, `Control interno`).
2. `fetchPersonasByRol(rol)` consulta Supabase directamente:
   - `USUARIOS_ROLES` con `estado = 'ACTIVO'`
   - *embed* `ROLES!usuarios_roles_id_rol_fkey!inner (nombre)` (filtrado por `ROLES.nombre` si se eligió rol)
   - *embed* `USUARIOS!inner (estado, PERSONAS (...))`
3. Se genera `usuarios-<rol|todos>-<AAAA-MM-DD>.xlsx` con una hoja **Usuarios**.

Columnas del archivo: Tipo documento, Número documento, Nombres, Apellidos, Correo, Teléfono, Estado persona, Estado usuario, Rol, Empresa a la que pertenece.

Un usuario con varios roles activos aparece una vez por cada rol. Si no hay resultados se muestra *"No hay usuarios que coincidan con ese filtro."*

> La consulta de exportación depende de que las políticas RLS permitan a `CONTROL_INTERNO` leer `USUARIOS_ROLES`, `USUARIOS`, `PERSONAS` y `ROLES` de todos los usuarios. PostgREST limita las respuestas a `max_rows` (1000 en [supabase/config.toml](../supabase/config.toml)), así que con más de 1000 asignaciones el archivo saldría incompleto.
