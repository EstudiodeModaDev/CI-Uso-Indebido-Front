export type EstadoCodigoOtp = 'ACTIVO' | 'USADO' | 'EXPIRADO'

export interface CodigoOtp {
  id: string
  id_persona: string
  codigo: string
  estado: EstadoCodigoOtp
  fecha_creacion: string
  fecha_expiracion: string
  fecha_uso: string | null
}

export interface generateOtpResponse {
  success: boolean;
  expiresAt: string;
  maskedEmail: string;
}

export interface validateOtpResponse {
  valid: true;
  remainingAttempts: number;
  expiresAt: string;
}

export interface otpRecord {
  id: number,
  persona_id: string,
  tienda_generacion_id: number,
  tienda_redencion_id: number
}

export type EstadoHistorialCodigo = 'REDIMIDO' | 'EXPIRADO'

export interface HistorialCodigo {
  id: string
  code: string | null
  status: EstadoHistorialCodigo
  generatedAt: string
  expiresAt: string
  redeemedAt: string | null
  purchaseValue: number
  "generateIn": string,
  "redeemIn": string
}

export type EstadoCodigoAdmin = 'PENDIENTE' | 'REDIMIDO' | 'EXPIRADO' | 'ANULADO' | 'BLOQUEADO'

export interface HistorialCodigoAdmin {
  id: string
  code: string | null
  status: EstadoCodigoAdmin
  document: string
  personName: string
  generatedAt: string
  expiresAt: string
  redeemedAt: string | null
  purchaseValue: number
  generateIn: string
  redeemIn: string | null
  invoiceNumber: number | null
}

export interface HistorialAdminFiltros {
  document?: string
  generationStoreId?: number
  redemptionStoreId?: number
  page: number
  pageSize: number
}

export interface HistorialAdminPagina {
  items: HistorialCodigoAdmin[]
  total: number
  page: number
  pageSize: number
}

export interface Tienda {
  id: number
  name: string
  code: string | null
  email: string
  status: boolean | null
}