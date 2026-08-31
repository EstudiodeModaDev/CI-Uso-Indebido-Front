import type { ChangeEvent, FormEvent } from 'react'
import './TableroControlInterno.css'
import AuthLayout from '../common/AuthLayout'
import { useHistorialAdmin } from '../../Funcionalidades/code/hooks/useHistorialAdmin'
import { useTiendas } from '../../Funcionalidades/stores/hooks/useTiendas'
import type { HistorialCodigoAdmin } from '../../models/code'
import { formatFechaHistorial, formatValorCompra } from '../../Funcionalidades/code/utils/otp.utils'

const STATUS_LABEL: Record<HistorialCodigoAdmin['status'], string> = {
  PENDIENTE: 'Pendiente',
  REDIMIDO: 'Redimido',
  EXPIRADO: 'Expirado',
  ANULADO: 'Anulado',
  BLOQUEADO: 'Bloqueado',
}

function statusClass(status: HistorialCodigoAdmin['status']) {
  return `tablero-control__status--${status.toLowerCase()}`
}

function TableroControlInterno() {
  const {
    items,
    total,
    page,
    pageSize,
    isLoading,
    error,
    document,
    setDocument,
    generationStoreId,
    setGenerationStoreId,
    redemptionStoreId,
    setRedemptionStoreId,
    goToPage,
    buscar,
  } = useHistorialAdmin()

  const { tiendas } = useTiendas()

  const totalPages = Math.max(Math.ceil(total / pageSize), 1)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    buscar()
  }

  const handleStoreChange =
    (setter: (value: number | null) => void) => (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value
      setter(value === '' ? null : Number(value))
    }

  return (
    <AuthLayout
      eyebrow="Control interno"
      title="Tablero de codigos generados."
      description="Consulta y filtra todos los codigos OTP generados, por cedula, tienda de generacion y tienda de redencion."
      hideBrandPanel
    >
      <div className="tablero-control__page">
        <div className="tablero-control__card">
          <header className="tablero-control__header">
            <h1>Codigos generados</h1>
            <p>Filtra por numero de cedula, tienda donde se genero el codigo y tienda donde se redimio.</p>
          </header>

          <form className="tablero-control__filters" onSubmit={handleSubmit}>
            <div className="tablero-control__field">
              <label htmlFor="filtro-cedula">Cedula</label>
              <input
                id="filtro-cedula"
                type="text"
                inputMode="numeric"
                placeholder="Numero de cedula"
                value={document}
                onChange={(event) => setDocument(event.target.value)}
              />
            </div>

            <div className="tablero-control__field">
              <label htmlFor="filtro-tienda-generacion">Tienda de generacion</label>
              <select
                id="filtro-tienda-generacion"
                value={generationStoreId ?? ''}
                onChange={handleStoreChange(setGenerationStoreId)}
              >
                <option value="">Todas las tiendas</option>
                {tiendas.map((tienda) => (
                  <option key={tienda.id} value={tienda.id}>
                    {tienda.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="tablero-control__field">
              <label htmlFor="filtro-tienda-redencion">Tienda de redencion</label>
              <select
                id="filtro-tienda-redencion"
                value={redemptionStoreId ?? ''}
                onChange={handleStoreChange(setRedemptionStoreId)}
              >
                <option value="">Todas las tiendas</option>
                {tiendas.map((tienda) => (
                  <option key={tienda.id} value={tienda.id}>
                    {tienda.name}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="tablero-control__submit" disabled={isLoading}>
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {error && <p className="tablero-control__error">{error}</p>}

          <div className="tablero-control__table-wrapper">
            <table className="tablero-control__table">
              <thead>
                <tr>
                  <th>Cedula</th>
                  <th>Nombre</th>
                  <th># Factura</th>
                  <th>Estado</th>
                  <th>Valor</th>
                  <th>Generado en</th>
                  <th>Redimido en</th>
                  <th>Generado el</th>
                  <th>Redimido el</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="tablero-control__empty">
                      No se encontraron codigos con los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.document || '—'}</td>
                    <td>{item.personName || '—'}</td>
                    <td>{item.invoiceNumber ?? 'Sin codigo'}</td>
                    <td>
                      <span className={`tablero-control__status ${statusClass(item.status)}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td>{formatValorCompra(item.purchaseValue)}</td>
                    <td>{item.generateIn || '—'}</td>
                    <td>{item.redeemIn ?? '—'}</td>
                    <td>{formatFechaHistorial(item.generatedAt)}</td>
                    <td>{formatFechaHistorial(item.redeemedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tablero-control__pagination">
            <span>
              {total === 0 ? 'Sin resultados' : `Pagina ${page} de ${totalPages} — ${total} codigo(s)`}
            </span>
            <div className="tablero-control__pagination-actions">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || isLoading}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                Siguiente
              </button>
            </div>
          </div>

          <p className="tablero-control__footer">
            © {new Date().getFullYear()} Estudio de Moda. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

export default TableroControlInterno
