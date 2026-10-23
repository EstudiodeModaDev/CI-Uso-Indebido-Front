# Compras y descuentos · Front

Aplicación web de Estudio de Moda para gestionar los descuentos de empleados y socios mediante códigos OTP: las tiendas generan y redimen los códigos, los beneficiarios consultan su historial y reportan usos indebidos, y control interno administra usuarios y audita todas las transacciones.

**Stack:** React 19 · TypeScript · Vite · Supabase (Auth, Postgres, Edge Functions) · API NestJS · Azure Static Web Apps

## Inicio rápido

```bash
npm install
# crear .env con VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY y VITE_API_URL
npm run dev
```

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Chequeo de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | ESLint |

Cada `push` a `main` se despliega automáticamente en Azure Static Web Apps. Ver [Arquitectura → Despliegue](docs/01-arquitectura.md#despliegue).

## Documentación

Toda la documentación está en [docs/](docs), un archivo por módulo.

### Front

| # | Documento | Contenido |
| --- | --- | --- |
| 01 | [Arquitectura general](docs/01-arquitectura.md) | Stack, estructura de carpetas, capas, rutas, variables de entorno y despliegue |
| 02 | [Autenticación, sesión y roles](docs/02-autenticacion-y-roles.md) | `AuthContext`, login, protección de rutas, roles, cambio obligatorio y recuperación de contraseña |
| 03 | [Generación y redención de OTP](docs/03-generacion-y-redencion-otp.md) | Flujo de la tienda: buscar persona, generar, validar y redimir el código (`/otp`) |
| 04 | [Historial y reportes](docs/04-historial-y-reportes.md) | Historial del beneficiario y reporte de uso indebido con notificación por correo (`/historial-codigos`) |
| 05 | [Mi cuenta](docs/05-mi-cuenta.md) | Datos del usuario y cambio voluntario de contraseña (`/mi-cuenta`) |
| 06 | [Administración: carga de usuarios](docs/06-admin-carga-usuarios.md) | Carga masiva desde Excel y exportación por rol (`/admin/usuarios`) |
| 07 | [Administración: tablero de códigos](docs/07-admin-tablero-codigos.md) | Auditoría de códigos, detalle de factura y exportación (`/admin/codigos`) |
| 08 | [Servicios e integraciones](docs/08-servicios-y-api.md) | Cliente de la API, uso de Supabase, catálogo de endpoints y API de correos |
| 09 | [Modelos de datos](docs/09-modelos-de-datos.md) | Tipos TypeScript y tablas de Supabase |
| 10 | [UI compartida y estilos](docs/10-ui-y-estilos.md) | `AuthLayout`, tokens CSS, toasts, modales y convenciones de formularios |

### Supabase y Edge Functions

| Documento | Contenido |
| --- | --- |
| [Supabase: proyecto y funciones](docs/supabase/README.md) | Resumen de funciones, claves, despliegue, `config.toml`, migraciones y crons |
| [bulk-create-users](docs/supabase/bulk-create-users.md) | Alta/actualización masiva de usuarios desde el Excel (la invoca el front) |
| [sincronizacion-you](docs/supabase/sincronizacion-you.md) | Sincronización de empleados desde SharePoint "YOU" (cron) |
| [migrate-sharepoint-users](docs/supabase/migrate-sharepoint-users.md) | Migración inicial desde SharePoint (versión anterior) |
| [keep-db-awake](docs/supabase/keep-db-awake.md) | Mantiene activa la base de datos (cron) |
| [ping-backend-health](docs/supabase/ping-backend-health.md) | Mantiene activo el backend (cron) |

### Pendientes

[Observaciones técnicas](docs/observaciones-tecnicas.md): problemas de seguridad, datos y front detectados al documentar el código.

## Proyectos relacionados

- **API NestJS:** `CI-Back-Compras-y-descuentos` (OTP, tiendas, facturas, correos de OTP).
