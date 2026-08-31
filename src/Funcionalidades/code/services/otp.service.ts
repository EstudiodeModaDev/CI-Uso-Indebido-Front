import { api } from '../../../services/api.service'
import type {
  CodigoOtp,
  generateOtpResponse,
  HistorialAdminFiltros,
  HistorialAdminPagina,
  HistorialCodigo,
  validateOtpResponse,
} from '../../../models/code'

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
