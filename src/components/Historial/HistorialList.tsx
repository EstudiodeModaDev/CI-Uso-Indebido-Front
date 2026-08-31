import type { HistorialCodigo } from '../../models/code'
import { formatFechaHistorial, formatValorCompra } from '../../Funcionalidades/code/utils/otp.utils'

interface HistorialListProps {
  historial: HistorialCodigo[]
  onReportar: (codigo: HistorialCodigo) => void
}

function statusClass(status: HistorialCodigo['status']) {
  return status === 'REDIMIDO' ? 'historial__status--redimido' : 'historial__status--expirado'
}

function HistorialList({ historial, onReportar }: HistorialListProps) {
  if (historial.length === 0) {
    return <p className="historial__empty">Esta persona no tiene codigos generados.</p>
  }

  return (
    <ul className="historial__list">
      {historial.map((item) => (
        <li key={item.id} className="historial__item">
          <div className="historial__item-main">
            <span className="historial__code">{item.code ?? 'Sin codigo'}</span>
            <span className={`historial__status ${statusClass(item.status)}`}>
              {item.status}
            </span>
          </div>

          <div className="historial__item-details">
            <span>
              Valor: <strong>{formatValorCompra(item.purchaseValue)}</strong>
            </span>
            <span>Generado: {formatFechaHistorial(item.generatedAt)}</span>
            <span>Vence: {formatFechaHistorial(item.expiresAt)}</span>
            <span>Redimido: {formatFechaHistorial(item.redeemedAt)}</span>
          </div>

          <button
            type="button"
            className="historial__report-btn"
            onClick={() => onReportar(item)}
          >
            Reportar
          </button>
        </li>
      ))}
    </ul>
  )
}

export default HistorialList
