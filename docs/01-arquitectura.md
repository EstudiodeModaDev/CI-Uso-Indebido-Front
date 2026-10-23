# 01 · Arquitectura general

## Qué es

`uso-indebido-front` es la aplicación web de **Compras y descuentos** de Estudio de Moda. Permite:

- A las **tiendas**: buscar a una persona por cédula, generarle un código OTP de descuento (que se le envía por correo) y redimirlo al registrar la compra.
- A los **beneficiarios** (empleados, socios): consultar el historial de sus códigos y reportar un uso indebido.
- A **control interno**: cargar usuarios masivamente desde Excel, exportarlos y auditar todos los códigos generados en un tablero.

## Stack

| Capa | Tecnología |
| --- | --- |
| UI | React 19 + TypeScript 6, compilado con Vite 8 |
| Optimización | React Compiler (`babel-plugin-react-compiler`, configurado en [vite.config.ts](../vite.config.ts)) |
| Enrutamiento | `react-router-dom` 7 (`BrowserRouter`) |
| Notificaciones | `react-hot-toast` |
| Autenticación y datos | `@supabase/supabase-js` 2 (Auth, PostgREST, Edge Functions) |
| Backend de negocio | API NestJS propia (`VITE_API_URL`), proyecto hermano `CI-Back-Compras-y-descuentos` |
| Excel | `xlsx` (SheetJS 0.20.3, desde el CDN de SheetJS) |
| Hosting | Azure Static Web Apps |

## Estructura de carpetas

```text
uso-indebido-front/
├── index.html                 # Punto de entrada HTML (monta #root)
├── staticwebapp.config.json   # Fallback SPA para Azure Static Web Apps
├── vite.config.ts             # Plugins React + React Compiler
├── public/                    # Assets estáticos (logo EDM, favicon)
├── src/
│   ├── main.tsx               # createRoot + StrictMode
│   ├── App.tsx                # Router, rutas protegidas, Toaster
│   ├── index.css / App.css    # Tokens de diseño y estilos base
│   ├── components/            # Pantallas y componentes visuales (por módulo)
│   │   ├── Login/             # Inicio de sesión y recuperación de contraseña
│   │   ├── Otp/               # Generación y redención de OTP (rol TIENDA)
│   │   ├── Historial/         # Historial de códigos y reporte de uso indebido
│   │   ├── Cuenta/            # Mi cuenta y cambio de contraseña
│   │   ├── Admin/             # Carga de usuarios y tablero de control interno
│   │   └── common/            # AuthLayout (layout compartido)
│   ├── contexts/              # AuthContext (sesión, perfil, roles)
│   ├── Funcionalidades/       # Lógica de negocio: hooks + services por dominio
│   │   ├── authentication/
│   │   ├── code/              # OTP: generar, validar, redimir, historial
│   │   ├── reportes/
│   │   ├── stores/
│   │   ├── usuarios/
│   │   └── common/
│   ├── models/                # Tipos TypeScript compartidos
│   └── services/              # Clientes base: API REST y Supabase
└── supabase/                  # Config del proyecto, migraciones y Edge Functions
```

## Capas y flujo de datos

La aplicación sigue una separación en tres capas. Cada módulo funcional respeta la misma dirección de dependencias:

```text
components/  ──usa──▶  Funcionalidades/<dominio>/hooks  ──usa──▶  Funcionalidades/<dominio>/services  ──usa──▶  services/
(pantallas)            (estado de carga, errores, toasts)          (llamadas a API / Supabase / Excel)          (api.service, supabase.service)
```

- **Componentes** (`src/components`): renderizan y manejan estado de formulario. No llaman a `fetch` directamente, salvo excepciones documentadas en cada módulo (por ejemplo, la búsqueda de persona en [Otp.tsx](../src/components/Otp/Otp.tsx) consulta Supabase directamente y [DetalleCodigoModal.tsx](../src/components/Admin/DetalleCodigoModal.tsx) usa `api` sin hook intermedio).
- **Hooks** (`src/Funcionalidades/*/hooks`): encapsulan una operación (`isLoading`, `error`, función de acción). Devuelven `null` en caso de error en lugar de lanzar, para que el componente decida qué mostrar.
- **Services** (`src/Funcionalidades/*/services`): funciones puras que hablan con la API, con Supabase o con SheetJS. Lanzan `Error` con un mensaje legible.
- **Clientes base** (`src/services`): [api.service.ts](../src/services/api.service.ts) y [supabase.service.ts](../src/services/supabase.service.ts). Ver [08-servicios-y-api.md](08-servicios-y-api.md).

## Rutas

Definidas en [App.tsx](../src/App.tsx). Todas, salvo `/login`, pasan por `ProtectedRoute`.

| Ruta | Componente | Acceso | Módulo |
| --- | --- | --- | --- |
| `/login` | `Login` | Público | [02](02-autenticacion-y-roles.md) |
| `/login-confirmado` | `RoleRedirect` | Cualquier sesión | [02](02-autenticacion-y-roles.md) |
| `/otp` | `Otp` | Requiere rol `TIENDA` | [03](03-generacion-y-redencion-otp.md) |
| `/historial-codigos` | `Historial` | Cualquier rol **excepto** `TIENDA` | [04](04-historial-y-reportes.md) |
| `/mi-cuenta` | `MiCuenta` | Cualquier rol **excepto** `TIENDA` | [05](05-mi-cuenta.md) |
| `/admin/usuarios` | `CargaUsuarios` (lazy) | Requiere rol `CONTROL_INTERNO` | [06](06-admin-carga-usuarios.md) |
| `/admin/codigos` | `TableroControlInterno` (lazy) | Requiere rol `CONTROL_INTERNO` | [07](07-admin-tablero-codigos.md) |
| `*` | Redirige a `/login` | — | — |

Las dos pantallas de administración se cargan con `React.lazy` para no incluir la librería `xlsx` en el bundle inicial de los usuarios que no la necesitan.

## Variables de entorno

Se leen en tiempo de build con `import.meta.env` (prefijo `VITE_`). En local van en `.env` (no versionado); en CI se inyectan desde los *secrets* de GitHub.

| Variable | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon/publishable) de Supabase |
| `VITE_API_URL` | URL base de la API NestJS (sin `/` final; las rutas empiezan por `/`) |

> Al ser variables `VITE_`, quedan embebidas en el JavaScript publicado. Nunca deben contener claves secretas (service role, secretos de Graph, etc.).

## Scripts

```bash
npm install      # instalar dependencias
npm run dev      # servidor de desarrollo de Vite con HMR
npm run build    # tsc -b (chequeo de tipos) + vite build → dist/
npm run preview  # servir dist/ localmente
npm run lint     # ESLint
```

## Despliegue

El workflow [.github/workflows/azure-static-web-apps-nice-cliff-05092f01e.yml](../.github/workflows/azure-static-web-apps-nice-cliff-05092f01e.yml):

1. Se dispara con `push` a `main` y con PRs hacia `main` (cada PR genera un entorno de *preview*, que se cierra al cerrar el PR).
2. Obtiene un token OIDC de GitHub y ejecuta `Azure/static-web-apps-deploy@v1`.
3. Construye la app desde `/` y publica `dist/`, inyectando `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_API_URL` desde los secrets del repositorio.

[staticwebapp.config.json](../staticwebapp.config.json) reescribe cualquier ruta a `/index.html`, necesario para que el enrutamiento del lado del cliente funcione al recargar una URL profunda (por ejemplo `/admin/codigos`).

Las Edge Functions de Supabase **no** se despliegan con este workflow; se publican manualmente con la CLI de Supabase (ver [supabase/README.md](supabase/README.md)).
