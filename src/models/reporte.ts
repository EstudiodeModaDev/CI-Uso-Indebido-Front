export interface ReporteCodigo {
  id: number
  persona_id: string,
  codigo_otp_id: number,
  tipo_reporte: string,
  descripcion: string,
  fecha_reporte: Date,
}

export interface CrearReportePayload {
  persona_id: string,
  codigo_otp_id: number,
  tipo_reporte: string,
  descripcion: string,
  fecha_reporte: Date,
}
