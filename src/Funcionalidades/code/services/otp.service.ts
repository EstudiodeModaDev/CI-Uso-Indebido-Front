import * as XLSX from 'xlsx'
import { api } from '../../../services/api.service'
import type {
  CodigoOtp,
  generateOtpResponse,
  HistorialAdminFiltros,
  HistorialAdminPagina,
  HistorialCodigo,
  HistorialCodigoAdmin,
  validateOtpResponse,
} from '../../../models/code'
import { formatFechaHistorial } from '../utils/otp.utils'

export function generarOtpRequest(idPersona: string): Promise<generateOtpResponse> {
  return api.post<generateOtpResponse>('/otp/generate', { document: idPersona })
}

export function validarOtpRequest(
  idPersona: string,
  codigo: string,
): Promise<validateOtpResponse> {
  return api.post<validateOtpResponse>('/otp/validate', { document: idPersona, code: codigo })
}

export function redimirOtpRequest(code: string, document: string, purchaseValue: number, invoiceNumber: number): Promise<CodigoOtp> {
  return api.post<CodigoOtp>('/otp/redeem', { document, code, purchaseValue, invoiceNumber})
}

export function historialOtpRequest(document: string, email: string): Promise<HistorialCodigo[]> {
  return api.post<HistorialCodigo[]>('/otp/history', { document, email })
}

export function historialAdminOtpRequest(
  filtros: HistorialAdminFiltros,
): Promise<HistorialAdminPagina> {
  return api.post<HistorialAdminPagina>('/otp/history/admin', filtros)
}

const EXPORT_PAGE_SIZE = 80

export async function fetchAllHistorialAdminOtp(
  filtros: Omit<HistorialAdminFiltros, 'page' | 'pageSize'>,
): Promise<HistorialCodigoAdmin[]> {
  const items: HistorialCodigoAdmin[] = []
  let page = 1

  while (true) {
    const resultado = await historialAdminOtpRequest({ ...filtros, page, pageSize: EXPORT_PAGE_SIZE })
    items.push(...resultado.items)
    if (resultado.items.length === 0 || items.length >= resultado.total) break
    page++
  }

  return items
}

export function exportHistorialAdminToExcel(rows: HistorialCodigoAdmin[]): void {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Cedula: row.document,
      Nombre: row.personName,
      '# Factura': row.invoiceNumber ?? 'Sin codigo',
      Estado: row.status,
      Valor: row.purchaseValue,
      'Generado en': row.generateIn,
      'Redimido en': row.redeemIn ?? '',
      'Generado el': formatFechaHistorial(row.generatedAt),
      'Redimido el': formatFechaHistorial(row.redeemedAt),
    })),
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial')

  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `historial-codigos-${fecha}.xlsx`)
}
