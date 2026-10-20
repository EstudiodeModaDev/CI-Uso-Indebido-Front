import { useEffect, useState } from 'react'
import './DetalleCodigoModal.css'
import type { HistorialCodigoAdmin } from '../../models/code'
import type { invoice } from '../../models/invoice'
import { api } from '../../services/api.service'
import { secureTrim } from '../../Funcionalidades/common/secureTrim'

interface DetalleCodigoModalProps {
  codigo: HistorialCodigoAdmin
  onClose: () => void
}

interface InvoiceResponse {
  data: invoice[]
}

const NO_DISPONIBLE = 'No disponible'
const CARGANDO = 'Cargando...'

function formatMoneda(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_DISPONIBLE
  return value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
}

function textoOVacio(value: string | null | undefined) {
  return secureTrim(value) || NO_DISPONIBLE
}

// La API puede enviar los valores monetarios como number o como string
function numeroOVacio(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (secureTrim(value) === '') return null
  return Number(value)
}

function itemATexto(item: unknown): string {
  if (item !== null && typeof item === 'object') {
    return Object.values(item).map(secureTrim).filter(Boolean).join(' · ')
  }
  return secureTrim(item)
}

// ItemsVendidos puede llegar como arreglo, como JSON en texto o como texto separado por lineas / ";" / "|"
function normalizarItems(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(itemATexto).filter(Boolean)
  if (value !== null && typeof value === 'object') return [itemATexto(value)].filter(Boolean)

  const texto = secureTrim(value)
  if (!texto) return []

  try {
    const parsed: unknown = JSON.parse(texto)
    if (parsed !== null && typeof parsed === 'object') return normalizarItems(parsed)
  } catch {
    // No es JSON, se separa como texto plano
  }

  return texto.split(/\r?\n|;|\|/).map(secureTrim).filter(Boolean)
}

function DetalleCodigoModal({ codigo, onClose }: DetalleCodigoModalProps) {
  const [invoiceConsultada, setInvoice] = useState<invoice | null>(null)
  const [cargandoFactura, setCargando] = useState(true)
  const [avisoFactura, setAviso] = useState<string | null>(null)

  // Sin numero de factura no hay nada que consultar: el estado se deriva en vez de fijarlo en el efecto
  const sinFactura = codigo.invoiceNumber === null
  const invoice = sinFactura ? null : invoiceConsultada
  const cargando = sinFactura ? false : cargandoFactura
  const aviso = sinFactura ? 'Este código no tiene un número de factura asociado.' : avisoFactura

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setCargando(true)
      setAviso(null)
      try {
        const response = await api.get<InvoiceResponse>(
          `/invoice?cedula=${encodeURIComponent(codigo.document)}&factura=${codigo.invoiceNumber}`
        )
        if (cancelled) return
        const encontrada = response.data?.[0] ?? null
        setInvoice(encontrada)
        if (!encontrada) {
          setAviso(`No se encontró la factura #${codigo.invoiceNumber} para la cédula ${codigo.document}.`)
        }
      } catch (error) {
        if (cancelled) return
        setInvoice(null)
        setAviso('No se pudo consultar la factura. Intenta de nuevo más tarde.')
        console.error(error)
      } finally {
        if (!cancelled) setCargando(false)
      }
    }

    if (codigo.invoiceNumber !== null) {
      void cargar()
    }

    return () => {
      cancelled = true
    }
  }, [codigo.document, codigo.invoiceNumber])

  const valor = (texto: string) => (cargando ? CARGANDO : texto)

  // Se priorizan los items de la factura; si no vienen, se usan los registrados al redimir
  const itemsFactura = normalizarItems(invoice?.ItemsVendidos)
  const itemsRegistrados = codigo.soldItems ?? []

  return (
    <div className="detalle-codigo-modal__overlay" role="presentation" onClick={onClose}>
      <div
        className="detalle-codigo-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-codigo-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="detalle-codigo-modal__header">
          <h2 id="detalle-codigo-modal-title">Detalle de la venta</h2>
          <button
            type="button"
            className="detalle-codigo-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        {!cargando && aviso && (
          <div className="detalle-codigo-modal__alert" role="alert">
            <span className="detalle-codigo-modal__alert-icon" aria-hidden="true">!</span>
            <p>{aviso}</p>
          </div>
        )}

        <dl className="detalle-codigo-modal__info">
          <div className="detalle-codigo-modal__info-row">
            <dt>Comprador</dt>
            <dd>{valor(textoOVacio(invoice?.NombreCompradorPOS))}</dd>
          </div>
          <div className="detalle-codigo-modal__info-row">
            <dt>Vendedor</dt>
            <dd>{valor(textoOVacio(invoice?.Vendedor))}</dd>
          </div>
          <div className="detalle-codigo-modal__info-row">
            <dt>Cajero</dt>
            <dd>{valor(textoOVacio(invoice?.Cajero))}</dd>
          </div>
          <div className="detalle-codigo-modal__divider" />
          <div className="detalle-codigo-modal__info-row">
            <dt># Factura</dt>
            <dd>{invoice?.NumeroFactura ?? codigo.invoiceNumber ?? NO_DISPONIBLE}</dd>
          </div>
          <div className="detalle-codigo-modal__info-row">
            <dt>Total factura</dt>
            <dd>{valor(formatMoneda(numeroOVacio(invoice?.ValorNeto)))}</dd>
          </div>
          <div className="detalle-codigo-modal__info-row">
            <dt>Descuento</dt>
            <dd>{valor(formatMoneda(numeroOVacio(invoice?.ValorDescuento)))}</dd>
          </div>
        </dl>

        <section className="detalle-codigo-modal__items">
          <h3>Items vendidos</h3>
          {cargando ? (
            <p className="detalle-codigo-modal__empty">{CARGANDO}</p>
          ) : itemsFactura.length > 0 ? (
            <ul className="detalle-codigo-modal__item-list">
              {itemsFactura.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : itemsRegistrados.length > 0 ? (
            <div className="detalle-codigo-modal__table-wrapper">
              <table className="detalle-codigo-modal__table">
                <thead>
                  <tr>
                    <th>Descripcion</th>
                    <th>Cant.</th>
                    <th>Valor unit.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsRegistrados.map((item, index) => (
                    <tr key={`${item.description}-${index}`}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoneda(item.unitPrice)}</td>
                      <td>{formatMoneda(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="detalle-codigo-modal__empty">No hay items registrados para esta venta.</p>
          )}
        </section>

        <div className="detalle-codigo-modal__actions">
          <button type="button" className="detalle-codigo-modal__cancel" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default DetalleCodigoModal
