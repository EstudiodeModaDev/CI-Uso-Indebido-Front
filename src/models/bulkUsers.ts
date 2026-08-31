export interface ExcelUserRow {
  tipo_documento: string
  numero_documento: string
  nombres: string
  apellidos: string
  correo: string
  telefono: string
  estado: string
  tipo_persona: string
}

export type BulkCreateRowStatus = 'created' | 'updated' | 'error'

export interface BulkCreateRowResult {
  fila: number
  correo: string
  status: BulkCreateRowStatus
  message: string
}

export interface BulkCreateSummary {
  total: number
  creados: number
  actualizados: number
  errores: number
  detalle: BulkCreateRowResult[]
}
