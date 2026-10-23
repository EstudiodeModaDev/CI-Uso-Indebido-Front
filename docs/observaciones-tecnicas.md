# Observaciones técnicas y pendientes

Hallazgos encontrados al documentar el código, a fecha 2026-10-23. Ninguno se ha corregido todavía; sirven como lista de trabajo pendiente.

## Seguridad y configuración

| # | Hallazgo | Dónde | Sugerencia |
| --- | --- | --- | --- |
| S1 | La URL de la API de correos y el destinatario de los reportes están fijos en el código | [useCrearReporte.ts](../src/Funcionalidades/reportes/hooks/useCrearReporte.ts), [ReportarModal.tsx](../src/components/Historial/ReportarModal.tsx) | Moverlos a variables de entorno o, mejor, enviar el correo desde la API |
| S2 | La API de correos se llama desde el navegador **sin autenticación**: cualquiera que vea el JavaScript puede enviar correos como `alert@estudiodemoda.com.co` | `useCrearReporte.ts` | Hacer que la API NestJS registre el reporte y envíe el correo en el servidor |
| S3 | `/otp` lee `PERSONAS` directamente con la clave pública; la exposición de datos personales depende solo de RLS | [Otp.tsx](../src/components/Otp/Otp.tsx) | Revisar las políticas RLS de `PERSONAS` o pasar la búsqueda a la API |
| S4 | `ping-backend-health` apunta por defecto a una URL de Render, pero el backend se despliega en Azure Web App | [ping-backend-health/index.ts](../supabase/functions/ping-backend-health/index.ts) | Definir `PING_HEALTH_TARGET_URL` o actualizar el valor por defecto |

## Datos y Edge Functions

| # | Hallazgo | Dónde | Sugerencia |
| --- | --- | --- | --- |
| D1 | Las migraciones no reflejan el esquema real (`PERSONAS`/`USUARIOS` distintos; falta `ROLES`, `USUARIOS_ROLES`, `LOG`, `REPORTES_USO_INDEBIDO`; existe `REPORTES`, que el front no usa) | [supabase/migrations](../supabase/migrations) | Generar una migración base con `supabase db pull` |
| D2 | `sincronizacion-you` vuelve a poner `requiere_cambio_password = true` (en `USUARIOS` y en los metadatos de Auth) en **cada** ejecución para todos los empleados activos | [sync.service.ts](../supabase/functions/sincronizacion-you/sync.service.ts) → `computeActiveChangeSet`, `buildManagedMetadata` | Forzar ese valor solo al crear o reparar el usuario |
| D3 | `migrate-sharepoint-users` inserta un `PERSONAS` nuevo en cada ejecución, también para usuarios existentes | [migrate-sharepoint-users/index.ts](../supabase/functions/migrate-sharepoint-users/index.ts) | Retirar la función si `sincronizacion-you` ya la reemplazó |
| D4 | El README de `bulk-create-users` dice que el rol sale de `tipo_persona` y que el máximo es 300; el código asigna siempre `SOCIO` y acepta 900 | [bulk-create-users/README.md](../supabase/functions/bulk-create-users/README.md) | Actualizar el README |
| D5 | La pantalla de carga dice "tipo persona (TIENDA o CONTROL_INTERNO)", pero la función ignora esa columna y asigna `SOCIO` | [CargaUsuarios.tsx](../src/components/Admin/CargaUsuarios.tsx) | Ajustar el texto de ayuda |
| D6 | La exportación de usuarios no pagina; PostgREST devuelve como máximo `max_rows` (1000) filas | [usuarios.service.ts](../src/Funcionalidades/usuarios/services/usuarios.service.ts) → `fetchPersonasByRol` | Paginar con `.range()` |
| D7 | La contraseña inicial es la cédula; en `sincronizacion-you` las cédulas más cortas que `AUTH_MINIMUM_PASSWORD_LENGTH` fallan al crear el usuario | `validators.ts` | Documentar el caso a soporte o definir otra contraseña inicial |

## Front

| # | Hallazgo | Dónde | Sugerencia |
| --- | --- | --- | --- |
| F1 | `console.log` de depuración con los roles del usuario | [Historial.tsx](../src/components/Historial/Historial.tsx) (efecto con `"Empezando"`) | Eliminarlo |
| F2 | El campo "Número de la factura" reutiliza `id="purchase-value"` y su `label` apunta al campo de valor | [OtpValidateBlock.tsx](../src/components/Otp/OtpValidateBlock.tsx) | Usar `id="invoice-number"` |
| F3 | `Number.isNaN(invoiceNumber)` se aplica a un `string` y siempre es `false`; `canValidar` no exige el número de factura | [Otp.tsx](../src/components/Otp/Otp.tsx) | Validar `Number(invoiceNumber)` e incluirlo en `canValidar` |
| F4 | El número de factura está limitado a 6 dígitos (`maxLength={6}`) | `OtpValidateBlock.tsx` | Confirmar con negocio el formato real de las facturas |
| F5 | El correo de reporte no incluye la razón escrita por el usuario, muestra el valor sin formato de moneda y puede mostrar `null` en "Redimido en" | `ReportarModal.tsx` | Incluir `razon`, usar `formatValorCompra` y un valor por defecto |
| F6 | Archivo vacío | [useObtenerOtps.ts](../src/Funcionalidades/code/hooks/useObtenerOtps.ts) | Eliminarlo |
| F7 | Un usuario sin el rol requerido es enviado a `/login` sin cerrar su sesión, y `/login` no redirige a un usuario ya autenticado | [App.tsx](../src/App.tsx) | Redirigir a `/login-confirmado` o mostrar una página de "sin permisos" |
| F8 | El enlace "Mi cuenta" se muestra a usuarios `TIENDA`, aunque la ruta los bloquea | [AuthLayout.tsx](../src/components/common/AuthLayout.tsx) | Ocultarlo para `TIENDA` |
| F9 | Los mensajes de error de la API en OTP se guardan en el hook pero no se muestran; el toast es genérico | `Otp.tsx` | Mostrar `error` del hook |
