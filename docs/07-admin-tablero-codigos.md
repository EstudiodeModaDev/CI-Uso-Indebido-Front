# 07 · Administración: tablero de códigos (control interno)

Tablero de auditoría con **todos** los códigos OTP generados, filtrable por cédula y tiendas, con detalle de la factura asociada y exportación a Excel.

- **Ruta:** `/admin/codigos`
- **Acceso:** requiere rol `CONTROL_INTERNO`
- Se carga con `React.lazy`. Usa `AuthLayout` con `hideBrandPanel` para ocupar todo el ancho.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| [components/Admin/TableroControlInterno.tsx](../src/components/Admin/TableroControlInterno.tsx) | Filtros, tabla, paginación y exportación |
| [components/Admin/DetalleCodigoModal.tsx](../src/components/Admin/DetalleCodigoModal.tsx) | Modal "Detalle de la venta" con datos de la factura |
| [Funcionalidades/code/hooks/useHistorialAdmin.ts](../src/Funcionalidades/code/hooks/useHistorialAdmin.ts) | Filtros, página actual y carga paginada |
| [Funcionalidades/code/hooks/useExportarHistorialAdmin.ts](../src/Funcionalidades/code/hooks/useExportarHistorialAdmin.ts) | Exportación de todos los resultados filtrados |
| [Funcionalidades/stores/hooks/useTiendas.ts](../src/Funcionalidades/stores/hooks/useTiendas.ts) | Carga del catálogo de tiendas para los selectores |
| [Funcionalidades/stores/services/stores.service.ts](../src/Funcionalidades/stores/services/stores.service.ts) | `GET /stores` |
| [Funcionalidades/code/services/otp.service.ts](../src/Funcionalidades/code/services/otp.service.ts) | `historialAdminOtpRequest`, `fetchAllHistorialAdminOtp`, `exportHistorialAdminToExcel` |
| [Funcionalidades/common/secureTrim.ts](../src/Funcionalidades/common/secureTrim.ts) | `trim` seguro ante `null`/`undefined`/no-strings |
| [models/code.ts](../src/models/code.ts), [models/invoice.ts](../src/models/invoice.ts) | `HistorialCodigoAdmin`, `HistorialAdminFiltros`, `HistorialAdminPagina`, `Tienda`, `invoice` |

## Filtros y paginación

| Filtro | Campo enviado | Notas |
| --- | --- | --- |
| Cédula | `document` | Se recorta; vacío = sin filtro |
| Tienda de generación | `generationStoreId` | Opciones desde `GET /stores` |
| Tienda de redención | `redemptionStoreId` | Opciones desde `GET /stores` |

- Los filtros **se aplican solo al pulsar "Buscar"** (`appliedFilters`); editar un campo no recarga la tabla.
- Al buscar se vuelve a la página 1.
- Tamaño de página fijo: **20**.
- Al montar la pantalla se carga la primera página sin filtros.
- Las peticiones obsoletas se descartan (`cancelled`) para evitar condiciones de carrera al paginar rápido.

Petición: `POST /otp/history/admin` con `{ document?, generationStoreId?, redemptionStoreId?, page, pageSize }` → `{ items, total, page, pageSize }`.

## Columnas de la tabla

| Columna | Campo | Formato |
| --- | --- | --- |
| Cédula | `document` | `—` si vacío |
| Nombre | `personName` | `—` si vacío |
| # Factura | `invoiceNumber` | `"Sin codigo"` si es `null` |
| Estado | `status` | Chip: Pendiente, Redimido, Expirado, Anulado, Bloqueado |
| Valor | `purchaseValue` | COP, o "No canjeado" |
| Generado en / Redimido en | `generateIn`, `redeemIn` | Nombre de tienda |
| Generado el / Redimido el | `generatedAt`, `redeemedAt` | `dd mmm aaaa` |
| Acciones | — | Botón **Ver detalle** |

## Detalle de la venta

`DetalleCodigoModal` consulta la factura en la API:

```
GET /invoice?cedula=<document>&factura=<invoiceNumber>   →   { data: invoice[] }
```

- Si el código no tiene `invoiceNumber`, no se consulta y se muestra *"Este código no tiene un número de factura asociado."*
- Se toma el primer elemento de `data`. Si no hay, se avisa que no se encontró la factura para esa cédula.
- Se cierra con **Escape**, con la ✕, con **Cerrar** o haciendo clic fuera.

Datos mostrados: comprador (`NombreCompradorPOS`), vendedor, cajero, número de factura, total (`ValorNeto`) y descuento (`ValorDescuento`). Los valores monetarios pueden llegar como número o texto; se normalizan antes de formatear.

**Ítems vendidos** — prioridad de fuentes:

1. `invoice.ItemsVendidos`, que puede llegar como arreglo, objeto, JSON en texto o texto separado por saltos de línea, `;` o `|` (`normalizarItems` contempla todos los casos y los muestra como lista).
2. Si no hay, `codigo.soldItems` (ítems registrados al redimir) en tabla de descripción, cantidad, valor unitario y total. La API todavía no envía este campo.
3. Si no hay ninguno: *"No hay items registrados para esta venta."*

## Exportación a Excel

**Exportar a Excel** usa los **filtros aplicados** (no los que están escritos sin buscar):

1. `fetchAllHistorialAdminOtp` recorre todas las páginas con `pageSize = 80` hasta reunir `total` elementos (o recibir una página vacía).
2. `exportHistorialAdminToExcel` genera `historial-codigos-<AAAA-MM-DD>.xlsx`, hoja **Historial**.

Columnas: Cédula, Nombre, # Factura, Estado, Valor, Generado en, Redimido en, Generado el, Redimido el.

Las páginas se piden en secuencia; con muchos resultados la exportación puede tardar, y el botón queda deshabilitado mientras tanto.
