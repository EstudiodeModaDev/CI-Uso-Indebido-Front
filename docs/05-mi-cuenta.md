# 05 · Mi cuenta

Pantalla de solo lectura con los datos del usuario autenticado y acceso al cambio voluntario de contraseña.

- **Ruta:** `/mi-cuenta`
- **Acceso:** cualquier sesión **sin** rol `TIENDA`
- Se llega desde el enlace "Mi cuenta" de la barra superior de [AuthLayout](10-ui-y-estilos.md#authlayout).

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| [components/Cuenta/MiCuenta.tsx](../src/components/Cuenta/MiCuenta.tsx) | Pantalla de datos personales y de cuenta |
| [components/Cuenta/CambiarPasswordModal.tsx](../src/components/Cuenta/CambiarPasswordModal.tsx) | Modal de cambio de contraseña (modo normal) |

No tiene hooks ni servicios propios: todo sale de `useAuth()` (ver [02-autenticacion-y-roles.md](02-autenticacion-y-roles.md)).

## Información que muestra

| Sección | Campo | Fuente |
| --- | --- | --- |
| Cabecera | Iniciales y nombre completo | `person.nombres`, `person.apellidos` |
| Cabecera | Estado de la cuenta | `profile.estado` → `Activa` / `Inactiva` / `Bloqueada` |
| Cabecera | Roles | `roles[].nombre` (un chip por rol activo) |
| Datos personales | Documento | `person.tipo_documento` + `person.numero_documento` |
| Datos personales | Correo personal | `person.correo` |
| Datos personales | Teléfono | `person.telefono` |
| Datos de la cuenta | Correo de acceso | `profile.correo` (correo de login) |
| Datos de la cuenta | Último ingreso | `profile.ultimo_ingreso`, con fecha y hora `es-CO`, o "Sin registro" |

Los datos no son editables desde la aplicación; el texto de la pantalla indica comunicarse con el administrador para actualizarlos.

## Cambio de contraseña voluntario

El botón **Cambiar contraseña** abre `CambiarPasswordModal` sin la propiedad `forced`:

- Se puede cerrar con la ✕, con **Cancelar** o haciendo clic fuera del panel.
- Mismas validaciones que el modo obligatorio: mínimo 8 caracteres, distinta del número de documento y confirmación igual.
- Al guardar llama a `changePassword()` del contexto, muestra *"Contraseña actualizada correctamente."* y cierra el modal.
