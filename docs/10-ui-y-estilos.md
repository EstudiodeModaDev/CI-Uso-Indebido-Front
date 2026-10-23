# 10 · UI compartida y estilos

## AuthLayout

[components/common/AuthLayout.tsx](../src/components/common/AuthLayout.tsx) es el layout de todas las pantallas (incluido el login).

| Prop | Tipo | Descripción |
| --- | --- | --- |
| `eyebrow` | `string` | Etiqueta pequeña sobre el título del panel de marca |
| `title` | `string` | Titular del panel de marca |
| `description` | `string` | Texto descriptivo del panel |
| `children` | `ReactNode` | Contenido principal |
| `hideBrandPanel` | `boolean` (opcional) | Oculta el panel lateral; lo usa el tablero de control interno para ganar ancho |

Estructura:

- **Panel de marca** (`aside.auth-shell__panel`): nombre "Compras y descuentos", logo [public/edm-logo.png](../public/edm-logo.png) y los textos recibidos por props.
- **Barra de cuenta** (solo con sesión): saludo con `person.nombres` (o el correo) y enlaces:
  - **Cargar usuarios** y **Tablero de códigos**, solo con rol `CONTROL_INTERNO`.
  - **Mi cuenta**.
  - **Cerrar sesión**.

> El enlace "Mi cuenta" también se muestra a usuarios `TIENDA`, pero esa ruta los bloquea y los envía a `/login`.

## Estilos

- CSS plano, un archivo `.css` por componente, importado desde el propio `.tsx`.
- Nombres de clase estilo **BEM** con el nombre del módulo como bloque: `otp__card`, `historial__status--redimido`, `cambiar-password-modal__panel`, etc.
- Sin librerías de componentes ni CSS-in-JS.

### Tokens de diseño

Definidos como variables CSS en `:root` en [index.css](../src/index.css), con una variante para modo oscuro en `@media (prefers-color-scheme: dark)`.

| Grupo | Variables |
| --- | --- |
| Color | `--color-primary`, `--color-primary-hover`, `--color-primary-active`, `--color-primary-soft`, `--color-accent`, `--color-accent-soft`, `--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse`, `--color-ink`, `--color-ink-soft`, `--color-lavender`, `--color-success`, `--color-success-soft`, `--color-warning`, `--color-danger`, `--color-danger-soft` |
| Tipografía | `--font-sans`, `--font-serif`, `--font-mono`, `--font-size-xs` … `--font-size-2xl`, `--font-weight-regular` … `--font-weight-bold` |
| Espaciado | `--space-1` … `--space-16` |
| Radios | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full` |
| Sombras | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Transiciones | `--transition-fast`, `--transition-base` |

Los componentes nuevos deben usar estos tokens en lugar de valores fijos.

## Notificaciones (toasts)

`<Toaster>` se monta una vez en [App.tsx](../src/App.tsx): arriba a la derecha, 4 s de duración, con estilos tomados de los tokens (`--color-surface`, `--color-success`, `--color-danger`…). Desde cualquier componente o hook:

```ts
import toast from 'react-hot-toast'
toast.success('Mensaje')
toast.error('Mensaje')
```

## Patrón de modales

Todos los modales (`OlvidePasswordModal`, `CambiarPasswordModal`, `ReportarModal`, `DetalleCodigoModal`) siguen la misma estructura:

```tsx
<div className="x__overlay" role="presentation" onClick={onClose}>
  <div className="x__panel" role="dialog" aria-modal="true" aria-labelledby="x-title"
       onClick={(e) => e.stopPropagation()}>
    …
  </div>
</div>
```

- Clic en el overlay = cerrar (salvo `CambiarPasswordModal` en modo `forced`).
- El panel detiene la propagación del clic.
- Los botones se deshabilitan mientras hay una operación en curso (`isSubmitting`).
- `DetalleCodigoModal` además se cierra con la tecla Escape.

## Formularios

Convenciones repetidas en todo el front:

- `noValidate` en el `<form>`; la validación se hace en JavaScript y los errores se muestran bajo cada campo con `aria-invalid` y `aria-describedby`.
- Los campos numéricos (cédula, código, valor, factura) usan `inputMode="numeric"` y eliminan los caracteres no numéricos en `onChange`.
- Los campos de contraseña tienen botón de mostrar/ocultar (`IconEye`).

## Formateadores

En [otp.utils.ts](../src/Funcionalidades/code/utils/otp.utils.ts):

| Función | Salida |
| --- | --- |
| `formatFechaHistorial(value)` | `dd mmm aaaa` en `es-CO`, o `—` si es nulo |
| `formatValorCompra(value)` | Moneda COP sin decimales, o `"No canjeado"` si es 0 o vacío |
